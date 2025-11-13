import axios from 'axios';
import { ZKProof, PublicInputs, PrivateWitness } from './types';

/**
 * Handles communication with the proof generation service
 */
export class ProofGenerator {
  private proverServiceUrl: string;

  constructor(proverServiceUrl: string) {
    this.proverServiceUrl = proverServiceUrl;
  }

  /**
   * Generate a ZK proof for payment verification
   */
  async generateProof(params: {
    publicInputs: PublicInputs;
    privateWitness: PrivateWitness;
  }): Promise<ZKProof> {
    const startTime = Date.now();

    try {
      const response = await axios.post<ZKProof>(
        `${this.proverServiceUrl}/generate-proof`,
        {
          // Public inputs
          minAmount: params.publicInputs.minAmount.toString(),
          recipientKey: params.publicInputs.recipientKey,
          maxBlockAge: params.publicInputs.maxBlockAge.toString(),
          currentTime: params.publicInputs.currentTime,

          // Private witness
          actualAmount: params.privateWitness.actualAmount.toString(),
          senderKey: params.privateWitness.senderKey,
          txHash: params.privateWitness.txHash,
          paymentTime: params.privateWitness.paymentTime,
          signature: params.privateWitness.signature,
        },
        {
          timeout: 10000, // 10 second timeout
        }
      );

      const totalTime = Date.now() - startTime;
      console.log(`Proof generation took ${totalTime}ms (includes network latency)`);

      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(
          `Proof generation failed: ${error.response.data.error || error.message}`
        );
      } else if (error.request) {
        throw new Error(
          `Proof service unreachable at ${this.proverServiceUrl}`
        );
      } else {
        throw new Error(`Proof generation error: ${error.message}`);
      }
    }
  }

  /**
   * Check if proof service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.proverServiceUrl}/health`, {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get proof service info
   */
  async getServiceInfo(): Promise<any> {
    try {
      const response = await axios.get(`${this.proverServiceUrl}/health`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get service info: ${error.message}`);
    }
  }
}
