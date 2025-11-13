import { Connection, PublicKey } from '@solana/web3.js';

/**
 * Fallback and retry mechanisms for production resilience
 */

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number;
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  errorCallback?: (error: Error, attempt: number) => void
): Promise<T> {
  let lastError: Error;
  let delay = config.baseDelay;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      if (errorCallback) {
        errorCallback(error, attempt);
      }

      if (attempt < config.maxAttempts) {
        console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await sleep(delay);
        delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
      }
    }
  }

  throw new Error(
    `Failed after ${config.maxAttempts} attempts: ${lastError!.message}`
  );
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fallback RPC endpoints for Solana
 */
export class SolanaRPCFallback {
  private endpoints: string[];
  private currentIndex: number = 0;
  private failedEndpoints: Set<string> = new Set();
  private connections: Map<string, Connection> = new Map();

  constructor(endpoints: string[]) {
    if (endpoints.length === 0) {
      throw new Error('At least one RPC endpoint required');
    }
    this.endpoints = endpoints;
  }

  /**
   * Get a working connection with automatic fallback
   */
  async getConnection(): Promise<Connection> {
    // Try current endpoint first
    const currentEndpoint = this.endpoints[this.currentIndex];

    if (!this.failedEndpoints.has(currentEndpoint)) {
      const conn = this.getOrCreateConnection(currentEndpoint);
      if (await this.testConnection(conn, currentEndpoint)) {
        return conn;
      }
    }

    // Try all endpoints
    for (let i = 0; i < this.endpoints.length; i++) {
      const endpoint = this.endpoints[i];

      if (this.failedEndpoints.has(endpoint)) {
        continue;
      }

      const conn = this.getOrCreateConnection(endpoint);
      if (await this.testConnection(conn, endpoint)) {
        this.currentIndex = i;
        return conn;
      }
    }

    // All endpoints failed - clear failed set and try again
    console.warn('All RPC endpoints failed, resetting and retrying...');
    this.failedEndpoints.clear();

    const conn = this.getOrCreateConnection(this.endpoints[0]);
    this.currentIndex = 0;
    return conn;
  }

  private getOrCreateConnection(endpoint: string): Connection {
    if (!this.connections.has(endpoint)) {
      this.connections.set(endpoint, new Connection(endpoint, 'confirmed'));
    }
    return this.connections.get(endpoint)!;
  }

  private async testConnection(
    conn: Connection,
    endpoint: string
  ): Promise<boolean> {
    try {
      await conn.getVersion();
      return true;
    } catch (error) {
      console.warn(`RPC endpoint ${endpoint} failed health check`);
      this.failedEndpoints.add(endpoint);
      return false;
    }
  }

  /**
   * Get current endpoint info
   */
  getStatus(): {
    current: string;
    total: number;
    failed: number;
  } {
    return {
      current: this.endpoints[this.currentIndex],
      total: this.endpoints.length,
      failed: this.failedEndpoints.size,
    };
  }
}

/**
 * Prover service fallback
 */
export class ProverServiceFallback {
  private endpoints: string[];
  private currentIndex: number = 0;
  private healthStatus: Map<string, boolean> = new Map();

  constructor(endpoints: string[]) {
    if (endpoints.length === 0) {
      throw new Error('At least one prover endpoint required');
    }
    this.endpoints = endpoints;

    // Initialize all as healthy
    endpoints.forEach((ep) => this.healthStatus.set(ep, true));
  }

  /**
   * Get next healthy prover endpoint
   */
  async getEndpoint(): Promise<string> {
    // Try current endpoint first
    const current = this.endpoints[this.currentIndex];
    if (this.healthStatus.get(current)) {
      return current;
    }

    // Find next healthy endpoint
    for (let i = 0; i < this.endpoints.length; i++) {
      const endpoint = this.endpoints[i];
      if (this.healthStatus.get(endpoint)) {
        this.currentIndex = i;
        return endpoint;
      }
    }

    // All unhealthy - reset and use first
    console.warn('All prover endpoints unhealthy, resetting...');
    this.endpoints.forEach((ep) => this.healthStatus.set(ep, true));
    this.currentIndex = 0;
    return this.endpoints[0];
  }

  /**
   * Mark endpoint as failed
   */
  markFailed(endpoint: string): void {
    this.healthStatus.set(endpoint, false);

    // Re-enable after 1 minute
    setTimeout(() => {
      this.healthStatus.set(endpoint, true);
    }, 60000);
  }

  /**
   * Check endpoint health
   */
  async checkHealth(endpoint: string): Promise<boolean> {
    try {
      const response = await fetch(`${endpoint}/health`);
      const healthy = response.ok;
      this.healthStatus.set(endpoint, healthy);
      return healthy;
    } catch (error) {
      this.healthStatus.set(endpoint, false);
      return false;
    }
  }

  /**
   * Check health of all endpoints
   */
  async checkAllHealth(): Promise<Map<string, boolean>> {
    await Promise.all(
      this.endpoints.map((endpoint) => this.checkHealth(endpoint))
    );
    return new Map(this.healthStatus);
  }
}

/**
 * Circuit breaker pattern for service calls
 */
export class CircuitBreaker {
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private threshold: number = 5, // failures before opening
    private timeout: number = 60000, // 1 minute
    private retryAfter: number = 30000 // 30 seconds
  ) {}

  /**
   * Execute function through circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.retryAfter) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();

      // Success - reset if half-open
      if (this.state === 'HALF_OPEN') {
        this.close();
      }

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.open();
    }
  }

  private open(): void {
    this.state = 'OPEN';
    console.warn(`Circuit breaker opened after ${this.failureCount} failures`);
  }

  private close(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    console.log('Circuit breaker closed');
  }

  getState(): string {
    return this.state;
  }
}
