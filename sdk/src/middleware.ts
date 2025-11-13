import { Connection, PublicKey } from '@solana/web3.js';
import { VerificationResult } from './types';
import { LocalVerifier, quickValidation } from './verifier';

/**
 * Express/Node middleware for verifying x402 ZK proofs
 */
export class X402ZKMiddleware {
  private connection: Connection;
  private verifierProgramId: PublicKey;
  private localVerifier: LocalVerifier;

  constructor(
    solanaRpcUrl: string,
    verifierProgramId: PublicKey,
    verificationKey?: any
  ) {
    this.connection = new Connection(solanaRpcUrl, 'confirmed');
    this.verifierProgramId = verifierProgramId;
    this.localVerifier = new LocalVerifier();

    if (verificationKey) {
      this.localVerifier.loadVerificationKey(verificationKey);
    }
  }

  /**
   * Load verification key for local proof verification
   */
  async loadVerificationKey(vkey: any): Promise<void> {
    await this.localVerifier.loadVerificationKey(vkey);
  }

  /**
   * Express middleware function
   */
  middleware() {
    return async (req: any, res: any, next: any) => {
      const proof = req.headers['x-zk-proof'];
      const publicInputs = req.headers['x-zk-public-inputs'];

      if (!proof || !publicInputs) {
        return res.status(402).json({
          error: 'Payment Required',
          message: 'Missing ZK proof headers',
        });
      }

      const startTime = Date.now();

      try {
        const result = await this.verifyProof(proof, publicInputs);

        if (!result.valid) {
          return res.status(402).json({
            error: 'Payment Required',
            message: 'Invalid payment proof',
            details: result.error,
          });
        }

        const verificationTime = Date.now() - startTime;

        // Add verification info to response headers
        res.setHeader('X-Proof-Verified', 'true');
        res.setHeader('X-Verification-Time-Ms', verificationTime.toString());
        res.setHeader('X-Verification-Method', result.verificationMethod);

        // Attach verification result to request
        req.zkProofVerification = result;

        next();
      } catch (error: any) {
        console.error('Proof verification error:', error);
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Proof verification failed',
        });
      }
    };
  }

  /**
   * Verify proof (can be on-chain or local)
   */
  private async verifyProof(
    proof: string,
    publicInputs: string
  ): Promise<VerificationResult> {
    try {
      // Parse proof and public inputs
      const proofData = JSON.parse(proof);
      const publicInputsData = JSON.parse(publicInputs);

      // For now, we'll do local verification
      // In production, you might want to verify on-chain for maximum security
      const isValid = await this.verifyLocally(proofData, publicInputsData);

      return {
        valid: isValid,
        verificationMethod: 'local',
      };
    } catch (error: any) {
      return {
        valid: false,
        verificationMethod: 'local',
        error: error.message,
      };
    }
  }

  /**
   * Local proof verification using real cryptography (faster than on-chain)
   */
  private async verifyLocally(
    proof: any,
    publicInputs: any
  ): Promise<boolean> {
    // Quick validation first
    const quickCheck = quickValidation(publicInputs);
    if (!quickCheck.valid) {
      throw new Error(quickCheck.error);
    }

    // Convert public inputs to array format for snarkjs
    const publicSignals = [
      publicInputs.minAmount,
      publicInputs.recipientKeyX || publicInputs.recipientKey,
      publicInputs.recipientKeyY || '0',
      publicInputs.maxBlockAge,
      publicInputs.currentTime,
    ];

    try {
      // Perform actual cryptographic verification using snarkjs
      const isValid = await this.localVerifier.verifyProof(proof, publicSignals);
      return isValid;
    } catch (error: any) {
      throw new Error(`Cryptographic verification failed: ${error.message}`);
    }
  }

  /**
   * On-chain proof verification (slower, but maximally trustless)
   */
  private async verifyOnChain(
    proof: any,
    publicInputs: any
  ): Promise<VerificationResult> {
    // This would call the Solana program to verify the proof on-chain
    // Requires building and sending a transaction

    // TODO: Implement on-chain verification
    throw new Error('On-chain verification not yet implemented');
  }

  /**
   * Simple middleware for testing (accepts any proof)
   */
  static mockMiddleware() {
    return (req: any, res: any, next: any) => {
      console.log('Mock verification - accepting all proofs');
      res.setHeader('X-Proof-Verified', 'true');
      res.setHeader('X-Verification-Method', 'mock');
      next();
    };
  }
}
