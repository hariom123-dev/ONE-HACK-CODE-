/**
 * x402 Service Provider — Main Server
 *
 * Payment-protected service API endpoints on Algorand TestNet.
 * Forked from Larp's x402-server/index.ts and adapted for
 * translation, storage, and compute service endpoints.
 *
 * Architecture:
 *   - Hono web framework with @x402/hono payment middleware
 *   - HTTPFacilitatorClient → GoPlausible for verification
 *   - ExactAvmScheme for Algorand TestNet (CAIP-2)
 *   - 3 service endpoints, each requiring USDC micropayment
 *   - SHA-256 delivery hashes for on-chain verification
 *   - X-Request-Id idempotency (no double-billing on retry)
 *
 * Start: npm start (runs on port 4022)
 * Test:  curl http://localhost:4022/health
 */

import { config } from 'dotenv';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { paymentMiddleware } from '@x402/hono';
import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import type { ResourceServerExtension } from '@x402/core/types';
import { ExactAvmScheme } from '@x402/avm/exact/server';
import { bazaarResourceServerExtension } from '@x402-avm/extensions';

// Full base64 CAIP-2 identifier required by GoPlausible facilitator
const ALGORAND_TESTNET_CAIP2 = 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=';

// Import service handlers
import { handleTranslateRequest } from './handlers/translate.js';
import { handleStorageRequest, handleStorageRetrieveRequest } from './handlers/storage.js';
import { handleComputeRequest } from './handlers/compute.js';

// Import endpoint configuration
import createPaymentConfig, { EndpointConfig } from './endpoints.config.js';

// Load environment variables
config();

// ════════════════════════════════════════════════════════════════════
// CONFIGURATION & SETUP
// ════════════════════════════════════════════════════════════════════

const avmAddress = process.env.AVM_ADDRESS;
const facilitatorUrl = process.env.FACILITATOR_URL;
const port = parseInt(process.env.PORT || '4022', 10);

// Validate required environment
if (!avmAddress || !facilitatorUrl) {
  console.error(
    '❌ Missing required environment variables:\n' +
    '   - AVM_ADDRESS (your Algorand wallet receiving payments)\n' +
    '   - FACILITATOR_URL (x402 facilitator service)'
  );
  process.exit(1);
}

console.log('\n' + '═'.repeat(60));
console.log('x402 SERVICE PROVIDER SERVER');
console.log('═'.repeat(60));
console.log('Configuration:');
console.log(`  Receiver Address: ${avmAddress}`);
console.log(`  Facilitator: ${facilitatorUrl}`);
console.log(`  Port: ${port}`);
console.log(`  Groq API: ${process.env.GROQ_API_KEY ? '✓ configured' : '⚠ not set (using fallbacks)'}`);
console.log('═'.repeat(60) + '\n');

// Initialize x402 Resource Server with GoPlausible facilitator
const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
const x402Server = new x402ResourceServer(facilitatorClient)
  .register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme())
  .registerExtension(bazaarResourceServerExtension as unknown as ResourceServerExtension);

// Create Hono app
const app = new Hono();

// ════════════════════════════════════════════════════════════════════
// MIDDLEWARE STACK
// ════════════════════════════════════════════════════════════════════

/**
 * CORS Middleware — Required for x402 payment headers
 */
app.use('*', async (c, next) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE, HEAD',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': '*',
    'Access-Control-Max-Age': '86400',
  };

  if (c.req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  Object.entries(corsHeaders).forEach(([key, value]) => {
    c.header(key, value);
  });

  await next();
});

/**
 * Logging Middleware
 */
app.use('*', async (c, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] ${c.req.method.toUpperCase()} ${c.req.path}`);

  const requestId = c.req.header('X-Request-Id');
  if (requestId) {
    console.log(`  🔑 X-Request-Id: ${requestId}`);
  }
  if (c.req.header('payment-signature')) {
    console.log('  ✓ Payment-Signature header detected');
  }

  await next();
  console.log(`  Response: ${c.res.status}`);
});

/**
 * x402 Payment Middleware
 * Applies payment protection to all configured endpoints
 */
const paymentConfig: EndpointConfig = createPaymentConfig(avmAddress);
console.log('📋 Payment-Protected Service Endpoints:');
Object.entries(paymentConfig).forEach(([route, config]) => {
  const price = config.accepts[0]?.price || 'unknown';
  console.log(`   ${route} — ${price} USDC — ${config.description}`);
});
console.log();

app.use(paymentMiddleware(paymentConfig as any, x402Server));

// ════════════════════════════════════════════════════════════════════
// PAYMENT-PROTECTED SERVICE ENDPOINTS
// ════════════════════════════════════════════════════════════════════

// Translation — $0.002 USDC
app.post('/translate', handleTranslateRequest);

// Storage — $0.003 USDC
app.post('/store', handleStorageRequest);

// Compute — $0.005 USDC
app.post('/compute', handleComputeRequest);

// ════════════════════════════════════════════════════════════════════
// PUBLIC ENDPOINTS — No payment required
// ════════════════════════════════════════════════════════════════════

/**
 * Retrieve stored content by CID (public access)
 */
app.get('/store/:cid', handleStorageRetrieveRequest);

/**
 * Health check — verify server is running
 */
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'x402-service-provider',
    network: 'Algorand TestNet',
    uptime: process.uptime(),
    groqConfigured: !!process.env.GROQ_API_KEY,
    endpoints: {
      translate: { price: '$0.002 USDC', method: 'POST' },
      store: { price: '$0.003 USDC', method: 'POST' },
      compute: { price: '$0.005 USDC', method: 'POST' },
    },
  });
});

/**
 * Info — shows all configured endpoints and pricing
 */
app.get('/info', (c) => {
  return c.json({
    service: 'x402-service-provider',
    version: '1.0.0',
    description: 'Payment-protected translation, storage, and compute services',
    network: 'Algorand TestNet',
    receiver: avmAddress,
    facilitator: facilitatorUrl,
    features: {
      idempotency: 'X-Request-Id header prevents double-billing on retry',
      deliveryVerification: 'SHA-256 delivery hashes in X-Delivery-Hash response header',
      onChainVerification: 'Delivery hashes can be recorded on DeliveryVerifier.sol (Sepolia)',
    },
    endpoints: Object.entries(paymentConfig).map(([route, cfg]) => ({
      route,
      price: cfg.accepts[0]?.price,
      description: cfg.description,
    })),
  });
});

// ════════════════════════════════════════════════════════════════════
// ERROR HANDLING
// ════════════════════════════════════════════════════════════════════

app.notFound((c) => {
  return c.json(
    {
      error: 'Endpoint not found',
      path: c.req.path,
      hint: 'Try GET /health or GET /info for available endpoints',
      availableEndpoints: [
        'POST /translate — Text translation ($0.002 USDC)',
        'POST /store    — Content storage ($0.003 USDC)',
        'POST /compute  — AI inference ($0.005 USDC)',
        'GET  /health   — Health check (free)',
        'GET  /info     — API info (free)',
      ],
    },
    404
  );
});

// ════════════════════════════════════════════════════════════════════
// SERVER STARTUP
// ════════════════════════════════════════════════════════════════════

serve({ fetch: app.fetch, port }, () => {
  console.log('\n✅ x402 Service Provider is running!\n');
  console.log('═'.repeat(60));
  console.log('Endpoints:');
  console.log(`  API:     http://localhost:${port}`);
  console.log(`  Health:  http://localhost:${port}/health`);
  console.log(`  Info:    http://localhost:${port}/info`);
  console.log('═'.repeat(60));
  console.log('\n📚 Test commands:\n');
  console.log(`  curl http://localhost:${port}/health`);
  console.log(`  curl http://localhost:${port}/info`);
  console.log(`  curl -X POST http://localhost:${port}/translate`);
  console.log('  (↑ will return 402 Payment Required)\n');
  console.log('═'.repeat(60) + '\n');
});
