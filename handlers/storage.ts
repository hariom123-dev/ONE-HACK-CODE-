/**
 * x402 Service Provider — Storage Handler
 *
 * POST /store
 * Called ONLY after payment is verified by x402 middleware.
 * Stores content and returns a CID + SHA-256(content) for delivery verification.
 * Supports idempotency via X-Request-Id header.
 */

import type { Context } from 'hono';
import { createHash } from 'crypto';

// ─── In-memory idempotency cache ──────────────────────────────────────────────
const idempotencyCache = new Map<string, { status: number; body: any; deliveryHash: string }>();

// ─── In-memory content store (mock for IPFS/Arweave) ──────────────────────────
const contentStore = new Map<string, { content: string; contentType: string; metadata: any; storedAt: string }>();

/**
 * Compute SHA-256 hash of a string.
 */
function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Generate a mock CID (Content Identifier) similar to IPFS CIDv1.
 * In production, this would be an actual IPFS/Arweave upload.
 */
function generateCID(contentHash: string): string {
  return `bafybei${contentHash.substring(0, 52)}`;
}

/**
 * POST /store
 *
 * Request body:
 *   { content: string, contentType?: string, metadata?: object }
 *
 * Response:
 *   { cid, contentHash, size, contentType, deliveryHash, paidVia, timestamp }
 *
 * Headers:
 *   X-Request-Id (optional) — idempotency key
 *   X-Delivery-Hash (response) — SHA-256 of the delivered response
 */
export async function handleStorageRequest(c: Context) {
  try {
    console.log('✓ PAYMENT VERIFIED — POST /store executing');

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
    const content = body.content || '';
    const contentType = body.contentType || 'text/plain';
    const metadata = body.metadata || {};

    if (!content) {
      return c.json({ error: 'Missing required field: content' }, 400);
    }

    // ── Store content ──────────────────────────────────────────────
    const contentHash = sha256(content);
    const cid = generateCID(contentHash);
    const size = Buffer.byteLength(content, 'utf-8');

    // Store in memory (mock persistent storage)
    contentStore.set(cid, {
      content,
      contentType,
      metadata,
      storedAt: new Date().toISOString(),
    });

    console.log(`  📦 Content stored: CID=${cid}, size=${size} bytes`);

    // ── Build response with delivery hash ──────────────────────────
    const responsePayload = {
      cid,
      contentHash,
      size,
      contentType,
      metadata,
      storageProvider: 'x402-mock-storage',
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
    console.error('Error in storage handler:', error);
    return c.json({ error: 'Storage failed', detail: String(error) }, 500);
  }
}

/**
 * GET /store/:cid — Retrieve stored content by CID (public, no payment needed)
 */
export async function handleStorageRetrieveRequest(c: Context) {
  const cid = c.req.param('cid') ?? '';
  const stored = contentStore.get(cid);

  if (!stored) {
    return c.json({ error: 'Content not found', cid }, 404);
  }

  return c.json({
    cid,
    content: stored.content,
    contentType: stored.contentType,
    metadata: stored.metadata,
    storedAt: stored.storedAt,
  });
}
