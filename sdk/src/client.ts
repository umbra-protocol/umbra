import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import axios from 'axios';
import {
  ZKPaymentConfig,
  X402RequestOptions,
  X402Response,
  ZKProof,
  PaymentDetails,
} from './types';
import { ProofGenerator } from './proof-generator';
import {
  SolanaRPCFallback,
  retryWithBackoff,
  CircuitBreaker,
} from './fallback';

/**
 * Main client for making x402 requests with ZK payment proofs
 */
export class ZKPaymentClient {
  private connection: Connection;
  private proofGenerator: ProofGenerator;
  private config: ZKPaymentConfig;
  private rpcFallback?: SolanaRPCFallback;
  private circuitBreaker: CircuitBreaker;

  constructor(config: ZKPaymentConfig & { fallbackRpcUrls?: string[] }) {
    this.config = {
      maxBlockAge: 60, // Default 60 seconds
      ...config,
    };

    // Set up RPC fallback if multiple endpoints provided
    if (config.fallbackRpcUrls && config.fallbackRpcUrls.length > 0) {
      const allEndpoints = [config.solanaRpcUrl, ...config.fallbackRpcUrls];
      this.rpcFallback = new SolanaRPCFallback(allEndpoints);
    }

    this.connection = new Connection(config.solanaRpcUrl, 'confirmed');
    this.proofGenerator = new ProofGenerator(config.proverServiceUrl);
    this.circuitBreaker = new CircuitBreaker(5, 60000, 30000);
  }

  /**
   * Get connection with fallback support
   */
  private async getConnection(): Promise<Connection> {
    if (this.rpcFallback) {
      return await this.rpcFallback.getConnection();
    }
    return this.connection;
  }

  /**
   * Make an x402 HTTP request with ZK payment proof
   */
  async request<T = any>(
    options: X402RequestOptions,
    payer: Keypair
  ): Promise<X402Response<T>> {
    console.log(`Making x402 request to ${options.url}`);
    console.log(`Payment required: ${options.paymentAmount} lamports`);

    // Step 1: Make payment on Solana
    const paymentDetails = await this.makePayment(
      payer,
      options.paymentRecipient,
      options.paymentAmount
    );

    console.log(`✓ Payment sent: ${paymentDetails.signature}`);

    // Step 2: Generate ZK proof
    const proof = await this.proofGenerator.generateProof({
      publicInputs: {
        minAmount: options.paymentAmount,
        recipientKey: options.paymentRecipient.toBase58(),
        maxBlockAge: this.config.maxBlockAge!,
        currentTime: Math.floor(Date.now() / 1000),
      },
      privateWitness: {
        actualAmount: paymentDetails.amount,
        senderKey: payer.publicKey.toBase58(),
        txHash: paymentDetails.signature,
        paymentTime: paymentDetails.timestamp,
        signature: paymentDetails.signature,
      },
    });

    console.log(`✓ ZK proof generated in ${proof.generationTimeMs}ms`);

    // Step 3: Make HTTP request with proof
    const response = await this.makeHttpRequest<T>(options, proof);

    console.log(`✓ Request completed with status ${response.status}`);

    return response;
  }

  /**
   * Make payment on Solana with retry logic
   */
  private async makePayment(
    payer: Keypair,
    recipient: PublicKey,
    amount: number
  ): Promise<PaymentDetails> {
    return await retryWithBackoff(async () => {
      const connection = await this.getConnection();

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: recipient,
          lamports: amount,
        })
      );

      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [payer],
        {
          commitment: 'confirmed',
          preflightCommitment: 'confirmed',
        }
      );

      return {
        transaction,
        amount,
        recipient,
        sender: payer.publicKey,
        timestamp: Math.floor(Date.now() / 1000),
        signature,
      };
    });
  }

  /**
   * Make HTTP request with ZK proof in header
   */
  private async makeHttpRequest<T>(
    options: X402RequestOptions,
    proof: ZKProof
  ): Promise<X402Response<T>> {
    const headers = {
      'Content-Type': 'application/json',
      'X-ZK-PROOF': proof.proof,
      'X-ZK-PUBLIC-INPUTS': proof.publicInputs,
      ...options.headers,
    };

    try {
      const response = await axios({
        method: options.method || 'GET',
        url: options.url,
        headers,
        data: options.body,
      });

      return {
        data: response.data,
        proofVerified: response.headers['x-proof-verified'] === 'true',
        verificationTime: response.headers['x-verification-time-ms']
          ? parseInt(response.headers['x-verification-time-ms'])
          : undefined,
        headers: response.headers,
        status: response.status,
      };
    } catch (error: any) {
      if (error.response?.status === 402) {
        throw new Error('Payment required or proof verification failed');
      }
      throw error;
    }
  }

  /**
   * Get current balance of an account
   */
  async getBalance(pubkey: PublicKey): Promise<number> {
    return await this.connection.getBalance(pubkey);
  }

  /**
   * Get balance in SOL
   */
  async getBalanceSOL(pubkey: PublicKey): Promise<number> {
    const lamports = await this.getBalance(pubkey);
    return lamports / LAMPORTS_PER_SOL;
  }

  /**
   * Request airdrop (devnet/testnet only)
   */
  async requestAirdrop(pubkey: PublicKey, sol: number): Promise<string> {
    const signature = await this.connection.requestAirdrop(
      pubkey,
      sol * LAMPORTS_PER_SOL
    );
    await this.connection.confirmTransaction(signature);
    return signature;
  }
}
