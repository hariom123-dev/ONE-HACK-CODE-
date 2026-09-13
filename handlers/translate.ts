/**
 * x402 Service Provider — Translation Handler
 *
 * POST /translate
 * Called ONLY after payment is verified by x402 middleware.
 * Returns translated text + SHA-256(output) for delivery verification.
 * Supports idempotency via X-Request-Id header.
 */

import type { Context } from 'hono';
import { createHash } from 'crypto';
import Groq from 'groq-sdk';

// ─── In-memory idempotency cache ──────────────────────────────────────────────
// In production, use Redis or a database for persistence across restarts.
const idempotencyCache = new Map<string, { status: number; body: any; deliveryHash: string }>();

function getGroqClient(): Groq | null {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  return new Groq({ apiKey });
}

/**
 * Compute SHA-256 hash of a string (for delivery verification).
 */
function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * POST /translate
 *
 * Request body:
 *   { text: string, targetLanguage: string, sourceLanguage?: string }
 *
 * Response:
 *   { translatedText, sourceLanguage, targetLanguage, deliveryHash, paidVia, timestamp }
 *
 * Headers:
 *   X-Request-Id (optional) — idempotency key; duplicate requests return cached response
 *   X-Delivery-Hash (response) — SHA-256 of the delivered content
 */
export async function handleTranslateRequest(c: Context) {
  try {
    console.log('✓ PAYMENT VERIFIED — POST /translate executing');

    // ── Idempotency check ──────────────────────────────────────────
    const requestId = c.req.header('X-Request-Id');
    if (requestId) {
      const cached = idempotencyCache.get(requestId);
      if (cached) {
        console.log(`  ↩ Idempotency hit: returning cached response for ${requestId}`);
        c.header('X-Delivery-Hash', cached.deliveryHash);
        c.header('X-Idempotency-Status', 'cached');
        return c.json(cached.body, cached.status as any);
      }
    }

    // ── Parse request ──────────────────────────────────────────────
    const body = await c.req.json();
    const text = body.text || '';
    const targetLanguage = body.targetLanguage || 'es';
    const sourceLanguage = body.sourceLanguage || 'auto';

    if (!text) {
      return c.json({ error: 'Missing required field: text' }, 400);
    }

    // ── Translate ──────────────────────────────────────────────────
    let translatedText: string;

    const groq = getGroqClient();
    if (groq) {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the given text to ${targetLanguage}. Return ONLY the translated text, nothing else. Do not include quotes or explanations.`,
          },
          { role: 'user', content: text },
        ],
        temperature: 0.2,
        max_tokens: 2000,
      });
      translatedText = completion.choices[0]?.message?.content?.trim() ?? text;
    } else {
      // Fallback: simple mock translation
      translatedText = `[${targetLanguage}] ${text}`;
    }

    // ── Build response with delivery hash ──────────────────────────
    const responsePayload = {
      translatedText,
      sourceLanguage,
      targetLanguage,
      characterCount: text.length,
      paidVia: 'x402 / USDC Algorand Testnet',
      timestamp: new Date().toISOString(),
    };

    // SHA-256 of the delivered content for on-chain verification
    const deliveryHash = sha256(JSON.stringify(responsePayload));
    const fullResponse = { ...responsePayload, deliveryHash };

    // ── Cache for idempotency ──────────────────────────────────────
    if (requestId) {
      idempotencyCache.set(requestId, {
        status: 200,
        body: fullResponse,
        deliveryHash,
      });
      console.log(`  📝 Cached response for requestId: ${requestId}`);
    }

    // Set delivery hash in response header for easy extraction
    c.header('X-Delivery-Hash', deliveryHash);

    return c.json(fullResponse);
  } catch (error) {
    console.error('Error in translate handler:', error);
    return c.json({ error: 'Translation failed', detail: String(error) }, 500);
  }
}
