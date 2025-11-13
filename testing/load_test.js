/**
 * Load Testing for x402 ZK Payment System
 * Tests system behavior under high load
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

// Configuration
const CONFIG = {
  proverUrl: process.env.PROVER_URL || 'http://localhost:8080',
  serverUrl: process.env.SERVER_URL || 'http://localhost:3000',
  concurrentUsers: parseInt(process.env.CONCURRENT_USERS || '50'),
  requestsPerUser: parseInt(process.env.REQUESTS_PER_USER || '100'),
  rampUpTime: parseInt(process.env.RAMP_UP_TIME || '30'), // seconds
};

// Metrics
const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalLatency: 0,
  minLatency: Infinity,
  maxLatency: 0,
  latencies: [],
  errors: {},
  startTime: null,
  endTime: null,
};

// Sample proof request
function generateProofRequest() {
  const now = Math.floor(Date.now() / 1000);
  return {
    minAmount: '1000000',
    recipientKey: '5'.repeat(32),
    maxBlockAge: '60',
    currentTime: now,
    actualAmount: '1500000',
    senderKey: '1'.repeat(32),
    txHash: Math.random().toString(36).substring(7),
    paymentTime: now - 10,
    signature: '3'.repeat(32),
  };
}

// Make a single proof generation request
async function makeProofRequest() {
  const startTime = performance.now();

  try {
    const response = await axios.post(
      `${CONFIG.proverUrl}/generate-proof`,
      generateProofRequest(),
      { timeout: 10000 }
    );

    const endTime = performance.now();
    const latency = endTime - startTime;

    metrics.successfulRequests++;
    metrics.totalLatency += latency;
    metrics.latencies.push(latency);
    metrics.minLatency = Math.min(metrics.minLatency, latency);
    metrics.maxLatency = Math.max(metrics.maxLatency, latency);

    return { success: true, latency };
  } catch (error) {
    const endTime = performance.now();
    const latency = endTime - startTime;

    metrics.failedRequests++;

    const errorType = error.response?.status || error.code || 'unknown';
    metrics.errors[errorType] = (metrics.errors[errorType] || 0) + 1;

    return { success: false, latency, error: errorType };
  } finally {
    metrics.totalRequests++;
  }
}

// Simulate a single user
async function simulateUser(userId, requestsPerUser) {
  console.log(`User ${userId} starting...`);

  const results = [];
  for (let i = 0; i < requestsPerUser; i++) {
    const result = await makeProofRequest();
    results.push(result);

    // Random delay between requests (0-500ms)
    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 500)
    );
  }

  console.log(`User ${userId} completed ${requestsPerUser} requests`);
  return results;
}

// Calculate percentiles
function calculatePercentile(arr, percentile) {
  const sorted = arr.slice().sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}

// Run load test
async function runLoadTest() {
  console.log('='.repeat(60));
  console.log('x402 ZK Payment System - Load Test');
  console.log('='.repeat(60));
  console.log(`Concurrent users: ${CONFIG.concurrentUsers}`);
  console.log(`Requests per user: ${CONFIG.requestsPerUser}`);
  console.log(`Total requests: ${CONFIG.concurrentUsers * CONFIG.requestsPerUser}`);
  console.log(`Ramp-up time: ${CONFIG.rampUpTime}s`);
  console.log('='.repeat(60));

  // Health check
  console.log('\nHealth check...');
  try {
    const health = await axios.get(`${CONFIG.proverUrl}/health`);
    console.log('✓ Prover service is healthy');
  } catch (error) {
    console.error('✗ Prover service is not responding');
    process.exit(1);
  }

  metrics.startTime = Date.now();

  // Ramp up users gradually
  const delayBetweenUsers = (CONFIG.rampUpTime * 1000) / CONFIG.concurrentUsers;
  const userPromises = [];

  console.log('\nStarting load test...\n');

  for (let i = 0; i < CONFIG.concurrentUsers; i++) {
    userPromises.push(simulateUser(i + 1, CONFIG.requestsPerUser));

    // Ramp up delay
    if (i < CONFIG.concurrentUsers - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenUsers));
    }
  }

  // Wait for all users to complete
  await Promise.all(userPromises);

  metrics.endTime = Date.now();

  // Calculate results
  const duration = (metrics.endTime - metrics.startTime) / 1000;
  const avgLatency = metrics.totalLatency / metrics.totalRequests;
  const throughput = metrics.totalRequests / duration;
  const successRate = (metrics.successfulRequests / metrics.totalRequests) * 100;

  // Results
  console.log('\n' + '='.repeat(60));
  console.log('Load Test Results');
  console.log('='.repeat(60));
  console.log(`\nDuration: ${duration.toFixed(2)}s`);
  console.log(`Total requests: ${metrics.totalRequests}`);
  console.log(`Successful: ${metrics.successfulRequests}`);
  console.log(`Failed: ${metrics.failedRequests}`);
  console.log(`Success rate: ${successRate.toFixed(2)}%`);
  console.log(`\nThroughput: ${throughput.toFixed(2)} req/s`);

  console.log('\nLatency:');
  console.log(`  Min: ${metrics.minLatency.toFixed(2)}ms`);
  console.log(`  Max: ${metrics.maxLatency.toFixed(2)}ms`);
  console.log(`  Avg: ${avgLatency.toFixed(2)}ms`);
  console.log(`  P50: ${calculatePercentile(metrics.latencies, 50).toFixed(2)}ms`);
  console.log(`  P95: ${calculatePercentile(metrics.latencies, 95).toFixed(2)}ms`);
  console.log(`  P99: ${calculatePercentile(metrics.latencies, 99).toFixed(2)}ms`);

  if (Object.keys(metrics.errors).length > 0) {
    console.log('\nErrors:');
    Object.entries(metrics.errors).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  }

  console.log('\n' + '='.repeat(60));

  // Performance assessment
  console.log('\nPerformance Assessment:');
  if (successRate >= 99) {
    console.log('  ✓ Excellent reliability (≥99%)');
  } else if (successRate >= 95) {
    console.log('  ⚠ Good reliability (95-99%)');
  } else {
    console.log('  ✗ Poor reliability (<95%)');
  }

  if (avgLatency <= 150) {
    console.log('  ✓ Excellent performance (≤150ms avg)');
  } else if (avgLatency <= 300) {
    console.log('  ⚠ Good performance (150-300ms avg)');
  } else {
    console.log('  ✗ Poor performance (>300ms avg)');
  }

  if (throughput >= 50) {
    console.log('  ✓ Excellent throughput (≥50 req/s)');
  } else if (throughput >= 20) {
    console.log('  ⚠ Good throughput (20-50 req/s)');
  } else {
    console.log('  ✗ Poor throughput (<20 req/s)');
  }

  console.log('='.repeat(60));

  // Exit code based on success
  if (successRate < 95) {
    console.error('\n✗ Load test failed: Success rate below 95%');
    process.exit(1);
  }

  console.log('\n✓ Load test passed');
  process.exit(0);
}

// Run
if (require.main === module) {
  runLoadTest().catch((error) => {
    console.error('Load test error:', error);
    process.exit(1);
  });
}

module.exports = { runLoadTest };
