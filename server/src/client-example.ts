/**
 * Example client demonstrating how to make x402 requests with ZK proofs
 */

import { Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { ZKPaymentClient } from '@x402/zk-payments-sdk';
import dotenv from 'dotenv';

dotenv.config();

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const PROVER_SERVICE_URL = process.env.PROVER_SERVICE_URL || 'http://localhost:8080';
const VERIFIER_PROGRAM_ID = new PublicKey(
  process.env.VERIFIER_PROGRAM_ID || '11111111111111111111111111111111'
);
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

async function main() {
  console.log('x402 ZK Payment Client Example');
  console.log('='.repeat(60));

  // Create or load payer keypair
  // In production, load from secure key storage
  const payer = Keypair.generate();
  console.log(`Payer address: ${payer.publicKey.toBase58()}`);

  // Initialize ZK payment client
  const client = new ZKPaymentClient({
    proverServiceUrl: PROVER_SERVICE_URL,
    solanaRpcUrl: SOLANA_RPC_URL,
    verifierProgramId: VERIFIER_PROGRAM_ID,
  });

  // Request airdrop for testing (devnet only)
  console.log('\nRequesting airdrop...');
  try {
    await client.requestAirdrop(payer.publicKey, 1);
    console.log('✓ Airdrop successful');
  } catch (error) {
    console.log('Note: Airdrop failed (might be rate limited)');
  }

  const balance = await client.getBalanceSOL(payer.publicKey);
  console.log(`Balance: ${balance} SOL`);

  // Service provider's payment address (in production, this comes from 402 response)
  const serviceProvider = Keypair.generate().publicKey;
  console.log(`Service provider: ${serviceProvider.toBase58()}`);

  // Example 1: Get premium data
  console.log('\n' + '='.repeat(60));
  console.log('Example 1: GET /api/premium-data');
  console.log('='.repeat(60));

  try {
    const response = await client.request(
      {
        url: `${SERVER_URL}/api/premium-data`,
        method: 'GET',
        paymentAmount: 0.001 * LAMPORTS_PER_SOL, // 0.001 SOL
        paymentRecipient: serviceProvider,
      },
      payer
    );

    console.log('Response:', JSON.stringify(response.data, null, 2));
    console.log(`✓ Proof verified: ${response.proofVerified}`);
    console.log(`✓ Verification time: ${response.verificationTime}ms`);
  } catch (error: any) {
    console.error('Error:', error.message);
  }

  // Example 2: Call AI service
  console.log('\n' + '='.repeat(60));
  console.log('Example 2: POST /api/ai-service');
  console.log('='.repeat(60));

  try {
    const response = await client.request(
      {
        url: `${SERVER_URL}/api/ai-service`,
        method: 'POST',
        paymentAmount: 0.002 * LAMPORTS_PER_SOL, // 0.002 SOL
        paymentRecipient: serviceProvider,
        body: {
          prompt: 'Explain zero-knowledge proofs in simple terms',
        },
      },
      payer
    );

    console.log('Response:', JSON.stringify(response.data, null, 2));
    console.log(`✓ Proof verified: ${response.proofVerified}`);
  } catch (error: any) {
    console.error('Error:', error.message);
  }

  // Example 3: Request expensive computation
  console.log('\n' + '='.repeat(60));
  console.log('Example 3: POST /api/expensive-computation');
  console.log('='.repeat(60));

  try {
    const response = await client.request(
      {
        url: `${SERVER_URL}/api/expensive-computation`,
        method: 'POST',
        paymentAmount: 0.005 * LAMPORTS_PER_SOL, // 0.005 SOL
        paymentRecipient: serviceProvider,
        body: {
          operation: 'matrix-multiplication',
          parameters: {
            size: 1000,
            precision: 'double',
          },
        },
      },
      payer
    );

    console.log('Response:', JSON.stringify(response.data, null, 2));
    console.log(`✓ Proof verified: ${response.proofVerified}`);
  } catch (error: any) {
    console.error('Error:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Privacy Benefits:');
  console.log('- Service provider never saw your actual payment amounts');
  console.log('- Service provider cannot track your wallet address');
  console.log('- Service provider cannot correlate requests');
  console.log('- On-chain observers cannot link payments to API usage');
  console.log('='.repeat(60));
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { main };
