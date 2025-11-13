import { groth16 } from 'snarkjs';

/**
 * Local verification of Groth16 proofs using snarkjs
 * This performs the actual cryptographic verification
 */
export class LocalVerifier {
  private verificationKey: any;

  constructor(verificationKeyPath?: string) {
    // Verification key will be loaded from circuit compilation
    // For now, we'll load it dynamically when needed
  }

  /**
   * Load verification key from file or object
   */
  async loadVerificationKey(vkey: any): Promise<void> {
    this.verificationKey = vkey;
  }

  /**
   * Verify a Groth16 proof using snarkjs
   */
  async verifyProof(proof: any, publicSignals: any[]): Promise<boolean> {
    if (!this.verificationKey) {
      throw new Error('Verification key not loaded. Call loadVerificationKey() first.');
    }

    try {
      // Use snarkjs to verify the proof
      const isValid = await groth16.verify(
        this.verificationKey,
        publicSignals,
        proof
      );

      return isValid;
    } catch (error: any) {
      console.error('Proof verification error:', error);
      return false;
    }
  }

  /**
   * Verify proof from serialized strings (as received from HTTP headers)
   */
  async verifyFromStrings(
    proofJson: string,
    publicInputsJson: string
  ): Promise<boolean> {
    try {
      const proof = JSON.parse(proofJson);
      const publicSignals = JSON.parse(publicInputsJson);

      return await this.verifyProof(proof, publicSignals);
    } catch (error) {
      console.error('Failed to parse proof or public inputs:', error);
      return false;
    }
  }
}

/**
 * Helper to convert proof from gnark format to snarkjs format if needed
 */
export function convertProofFormat(gnarkProof: any): any {
  // gnark and snarkjs use different serialization formats
  // This function converts between them if necessary

  if (gnarkProof.pi_a && gnarkProof.pi_b && gnarkProof.pi_c) {
    // Already in snarkjs format
    return gnarkProof;
  }

  // Convert from gnark format
  // This is a placeholder - actual conversion depends on gnark's output format
  return {
    pi_a: gnarkProof.A || gnarkProof.a,
    pi_b: gnarkProof.B || gnarkProof.b,
    pi_c: gnarkProof.C || gnarkProof.c,
    protocol: 'groth16',
    curve: 'bn128',
  };
}

/**
 * Quick validation checks before doing expensive cryptographic verification
 */
export function quickValidation(publicInputs: any): {
  valid: boolean;
  error?: string;
} {
  // Check minimum amount is positive
  if (!publicInputs.minAmount || publicInputs.minAmount <= 0) {
    return { valid: false, error: 'Invalid minimum amount' };
  }

  // Check timestamp is reasonable (within last 5 minutes)
  const currentTime = Math.floor(Date.now() / 1000);
  const maxBlockAge = parseInt(publicInputs.maxBlockAge) || 60;

  if (!publicInputs.currentTime) {
    return { valid: false, error: 'Missing current time' };
  }

  const proofAge = currentTime - parseInt(publicInputs.currentTime);
  if (proofAge > maxBlockAge) {
    return { valid: false, error: `Proof is too old (${proofAge}s > ${maxBlockAge}s)` };
  }

  if (proofAge < -10) {
    return { valid: false, error: 'Proof is from the future' };
  }

  // Check recipient key is present
  if (!publicInputs.recipientKey) {
    return { valid: false, error: 'Missing recipient key' };
  }

  return { valid: true };
}
