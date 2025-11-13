import { PublicKey, Transaction } from '@solana/web3.js';

/**
 * ZK Proof structure returned from prover service
 */
export interface ZKProof {
  proof: string;
  publicInputs: string;
  generationTimeMs: number;
}

/**
 * Payment details for generating a ZK proof
 */
export interface PaymentDetails {
  transaction: Transaction;
  amount: number;
  recipient: PublicKey;
  sender: PublicKey;
  timestamp: number;
  signature: string;
}

/**
 * Public inputs for proof verification
 */
export interface PublicInputs {
  minAmount: number;
  recipientKey: string;
  maxBlockAge: number;
  currentTime: number;
}

/**
 * Private witness data for proof generation
 */
export interface PrivateWitness {
  actualAmount: number;
  senderKey: string;
  txHash: string;
  paymentTime: number;
  signature: string;
}

/**
 * Configuration for ZK payment client
 */
export interface ZKPaymentConfig {
  proverServiceUrl: string;
  solanaRpcUrl: string;
  verifierProgramId: PublicKey;
  maxBlockAge?: number; // Default: 60 seconds
}

/**
 * Options for making an x402 request with ZK proof
 */
export interface X402RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  paymentAmount: number;
  paymentRecipient: PublicKey;
}

/**
 * Response from x402 server including proof verification status
 */
export interface X402Response<T = any> {
  data: T;
  proofVerified: boolean;
  verificationTime?: number;
  headers: Record<string, string>;
  status: number;
}

/**
 * Verification result from on-chain or local verification
 */
export interface VerificationResult {
  valid: boolean;
  verificationMethod: 'on-chain' | 'local';
  computeUnits?: number;
  error?: string;
}
