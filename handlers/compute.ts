/**
 * x402 Service Provider — Compute Handler
 *
 * POST /compute
 * Called ONLY after payment is verified by x402 middleware.
 * Runs AI inference and returns result + SHA-256(result) for delivery verification.
 * Supports idempotency via X-Request-Id header.
 */

import type { Context } from 'hono';
import { createHash } from 'crypto';
import Groq from 'groq-sdk';

// ─── In-memory idempotency cache ──────────────────────────────────────────────
const idempotencyCache = new Map<string, { status: number; body: any; deliveryHash: string }>();

function getGroqClient(): Groq | null {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  return new Groq({ apiKey });
}

/**
 * Compute SHA-256 hash of a string.
 */
function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * POST /compute
 *
 * Request body:
 *   { prompt: string, model?: string, maxTokens?: number, temperature?: number, systemPrompt?: string }
 *
 * Response:
 *   { result, model, tokensUsed, finishReason, deliveryHash, paidVia, timestamp }
 *
 * Headers:
 *   X-Request-Id (optional) — idempotency key
 *   X-Delivery-Hash (response) — SHA-256 of the delivered response
 */
export async function handleComputeRequest(c: Context) {
  try {
    console.log('✓ PAYMENT VERIFIED — POST /compute executing');

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
    const prompt = body.prompt || '';
    const model = body.model || 'llama-3.3-70b-versatile';
    const maxTokens = body.maxTokens || 1000;
    const temperature = body.temperature ?? 0.7;
    const systemPrompt = body.systemPrompt || 'You are a helpful AI assistant. Provide clear, accurate, and well-structured responses.';

    if (!prompt) {
      return c.json({ error: 'Missing required field: prompt' }, 400);
    }

    // ── Run inference ──────────────────────────────────────────────
    let result: string;
    let tokensUsed = 0;
    let finishReason = 'stop';
    let actualModel = model;

    const groq = getGroqClient();
    if (groq) {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature,
        max_tokens: maxTokens,
      });

      result = completion.choices[0]?.message?.content?.trim() ?? '';
      tokensUsed = completion.usage?.total_tokens ?? 0;
      finishReason = completion.choices[0]?.finish_reason ?? 'stop';
      actualModel = completion.model ?? model;
    } else {
      // Fallback: mock compute response
      result = `[Compute Result] Analysis of: "${prompt.substring(0, 100)}"\n\n` +
        `This is a simulated compute response. In production, this would use ${model} ` +
        `for inference with max_tokens=${maxTokens} and temperature=${temperature}.\n\n` +
        `Key findings:\n` +
        `1. The prompt contains ${prompt.split(' ').length} words.\n` +
        `2. Estimated complexity: ${prompt.length > 200 ? 'high' : prompt.length > 50 ? 'medium' : 'low'}.\n` +
        `3. Recommended approach: detailed analysis with cross-referencing.`;
      tokensUsed = Math.ceil(prompt.split(' ').length * 1.5 + result.split(' ').length);
      actualModel = 'mock-compute';
    }

    // ── Build response with delivery hash ──────────────────────────
    const responsePayload = {
      result,
      model: actualModel,
      tokensUsed,
      finishReason,
      promptLength: prompt.length,
      paidVia: 'x402 / USDC Algorand Testnet',
      timestamp: new Date().toISOString(),
    };

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

    c.header('X-Delivery-Hash', deliveryHash);

    return c.json(fullResponse);
  } catch (error) {
    console.error('Error in compute handler:', error);
    return c.json({ error: 'Compute failed', detail: String(error) }, 500);
  }
}
