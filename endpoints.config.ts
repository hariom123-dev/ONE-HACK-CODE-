/**
 * x402 Service Provider — Endpoint Configuration
 *
 * Defines payment-protected service endpoints for translation, storage,
 * and compute. Each endpoint requires a USDC micropayment on Algorand Testnet.
 *
 * Adapted from Larp's x402-server/endpoints.config.ts
 */

import { USDC_TESTNET_ASA_ID } from '@x402/avm';
import { declareDiscoveryExtension } from '@x402-avm/extensions';

// Full base64 CAIP-2 identifier required by GoPlausible facilitator
const ALGORAND_TESTNET_CAIP2 = 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=';

export interface EndpointConfig {
  [key: string]: {
    accepts: Array<{
      scheme: 'exact';
      price: string;
      network: string;
      payTo: string;
      extra: { asset: number };
    }>;
    description: string;
    extensions?: Record<string, unknown>;
  };
}

/**
 * Payment configuration for all service provider endpoints.
 * Total cost per full pipeline: ~$0.01 USDC
 */
export function createPaymentConfig(avmAddress: string): EndpointConfig {
  return {
    // ══════════════════════════════════════════════════════════════════
    // SERVICE PROVIDER ENDPOINTS — Payment-Protected
    // ══════════════════════════════════════════════════════════════════

    /**
     * Translation Service
     * Translates text between languages using Groq LLaMA 3.3 70B
     * Returns translated text + SHA-256(output) for delivery verification
     */
    'POST /translate': {
      accepts: [
        {
          scheme: 'exact',
          price: '$0.002',
          network: ALGORAND_TESTNET_CAIP2,
          payTo: avmAddress,
          extra: { asset: Number(USDC_TESTNET_ASA_ID) },
        },
      ],
      description: 'Translation service — Translate text between languages — $0.002 USDC',
      extensions: declareDiscoveryExtension({
        bodyType: 'json',
        input: { text: 'Hello, world!', targetLanguage: 'es', sourceLanguage: 'en' },
        output: {
          example: {
            translatedText: '¡Hola, mundo!',
            sourceLanguage: 'en',
            targetLanguage: 'es',
            deliveryHash: 'sha256_of_output',
            paidVia: 'x402 / USDC Algorand Testnet',
          },
        },
      }),
    },

    /**
     * Storage Service
     * Stores content and returns a content identifier (CID) + SHA-256 hash
     * Simulates IPFS/Arweave-style content-addressable storage
     */
    'POST /store': {
      accepts: [
        {
          scheme: 'exact',
          price: '$0.003',
          network: ALGORAND_TESTNET_CAIP2,
          payTo: avmAddress,
          extra: { asset: Number(USDC_TESTNET_ASA_ID) },
        },
      ],
      description: 'Storage service — Store content and get CID — $0.003 USDC',
      extensions: declareDiscoveryExtension({
        bodyType: 'json',
        input: { content: 'Data to store', contentType: 'text/plain', metadata: {} },
        output: {
          example: {
            cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
            contentHash: 'sha256_of_content',
            size: 1024,
            deliveryHash: 'sha256_of_response',
            paidVia: 'x402 / USDC Algorand Testnet',
          },
        },
      }),
    },

    /**
     * Compute Service
     * Runs AI inference (text generation, summarization, analysis)
     * Returns result + SHA-256 hash for delivery verification
     */
    'POST /compute': {
      accepts: [
        {
          scheme: 'exact',
          price: '$0.005',
          network: ALGORAND_TESTNET_CAIP2,
          payTo: avmAddress,
          extra: { asset: Number(USDC_TESTNET_ASA_ID) },
        },
      ],
      description: 'Compute service — AI inference and analysis — $0.005 USDC',
      extensions: declareDiscoveryExtension({
        bodyType: 'json',
        input: { prompt: 'Summarize quantum computing advances', model: 'llama-3.3-70b', maxTokens: 1000 },
        output: {
          example: {
            result: 'Quantum computing has made significant advances...',
            model: 'llama-3.3-70b-versatile',
            tokensUsed: 450,
            deliveryHash: 'sha256_of_result',
            paidVia: 'x402 / USDC Algorand Testnet',
          },
        },
      }),
    },
  };
}

export default createPaymentConfig;
