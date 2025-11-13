/**
 * Stress Testing for x402 ZK Payment System
 * Pushes system beyond normal operational capacity
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

const CONFIG = {
  proverUrl: process.env.PROVER_URL || 'http://localhost:8080',
  initialConcurrency: 10,
  maxConcurrency: 200,
  stepSize: 10,
  requestsPerStep: 50,
  stepDuration: 10000, // 10 seconds per step
};

const metrics = {
  steps: [],
  breakingPoint: null,
};

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

async function makeRequest() {
  const startTime = performance.now();
  try {
    await axios.post(
      `${CONFIG.proverUrl}/generate-proof`,
      generateProofRequest(),
      { timeout: 30000 }
    );
    return {
      success: true,
      latency: performance.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      latency: performance.now() - startTime,
      error: error.response?.status || error.code,
    };
  }
}

async function runStressStep(concurrency) {
  console.log(`\nTesting with ${concurrency} concurrent requests...`);

  const stepMetrics = {
    concurrency,
    requests: 0,
    successes: 0,
    failures: 0,
    totalLatency: 0,
    latencies: [],
    errors: {},
  };

  const stepStartTime = Date.now();

  // Generate load for step duration
  const promises = [];
  while (Date.now() - stepStartTime < CONFIG.stepDuration) {
    // Maintain concurrency level
    while (promises.length < concurrency) {
      const promise = makeRequest().then((result) => {
        stepMetrics.requests++;
        if (result.success) {
          stepMetrics.successes++;
        } else {
          stepMetrics.failures++;
          stepMetrics.errors[result.error] = (stepMetrics.errors[result.error] || 0) + 1;
        }
        stepMetrics.totalLatency += result.latency;
        stepMetrics.latencies.push(result.latency);

        // Remove from promises array
        const index = promises.indexOf(promise);
        if (index > -1) promises.splice(index, 1);
      });

      promises.push(promise);
    }

    // Small delay
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  // Wait for remaining requests
  await Promise.all(promises);

  const duration = (Date.now() - stepStartTime) / 1000;
  const avgLatency = stepMetrics.totalLatency / stepMetrics.requests;
  const throughput = stepMetrics.requests / duration;
  const successRate = (stepMetrics.successes / stepMetrics.requests) * 100;
  const errorRate = (stepMetrics.failures / stepMetrics.requests) * 100;

  stepMetrics.duration = duration;
  stepMetrics.avgLatency = avgLatency;
  stepMetrics.throughput = throughput;
  stepMetrics.successRate = successRate;
  stepMetrics.errorRate = errorRate;

  console.log(`  Duration: ${duration.toFixed(1)}s`);
  console.log(`  Requests: ${stepMetrics.requests}`);
  console.log(`  Success rate: ${successRate.toFixed(1)}%`);
  console.log(`  Avg latency: ${avgLatency.toFixed(0)}ms`);
  console.log(`  Throughput: ${throughput.toFixed(1)} req/s`);

  if (Object.keys(stepMetrics.errors).length > 0) {
    console.log(`  Errors: ${JSON.stringify(stepMetrics.errors)}`);
  }

  return stepMetrics;
}

async function runStressTest() {
  console.log('='.repeat(60));
  console.log('x402 ZK Payment System - Stress Test');
  console.log('='.repeat(60));
  console.log(`Initial concurrency: ${CONFIG.initialConcurrency}`);
  console.log(`Max concurrency: ${CONFIG.maxConcurrency}`);
  console.log(`Step size: ${CONFIG.stepSize}`);
  console.log(`Step duration: ${CONFIG.stepDuration / 1000}s`);
  console.log('='.repeat(60));

  // Health check
  console.log('\nHealth check...');
  try {
    await axios.get(`${CONFIG.proverUrl}/health`);
    console.log('✓ Service is healthy\n');
  } catch (error) {
    console.error('✗ Service is not responding');
    process.exit(1);
  }

  console.log('Starting stress test...');
  console.log('Will gradually increase load until breaking point\n');

  let concurrency = CONFIG.initialConcurrency;
  let systemFailed = false;

  while (concurrency <= CONFIG.maxConcurrency && !systemFailed) {
    const stepMetrics = await runStressStep(concurrency);
    metrics.steps.push(stepMetrics);

    // Check if system is breaking
    if (stepMetrics.errorRate > 20) {
      console.log(`\n⚠ High error rate detected (${stepMetrics.errorRate.toFixed(1)}%)`);
      metrics.breakingPoint = concurrency;
      systemFailed = true;
    } else if (stepMetrics.avgLatency > 5000) {
      console.log(`\n⚠ High latency detected (${stepMetrics.avgLatency.toFixed(0)}ms)`);
      metrics.breakingPoint = concurrency;
      systemFailed = true;
    } else if (stepMetrics.successRate < 80) {
      console.log(`\n⚠ Low success rate detected (${stepMetrics.successRate.toFixed(1)}%)`);
      metrics.breakingPoint = concurrency;
      systemFailed = true;
    }

    if (!systemFailed) {
      concurrency += CONFIG.stepSize;

      // Cool down between steps
      if (concurrency <= CONFIG.maxConcurrency) {
        console.log(`\nCooling down for 5 seconds...`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  // Results
  console.log('\n' + '='.repeat(60));
  console.log('Stress Test Results');
  console.log('='.repeat(60));

  if (metrics.breakingPoint) {
    console.log(`\nBreaking Point: ${metrics.breakingPoint} concurrent requests`);
    console.log(`System remained stable up to ${metrics.breakingPoint - CONFIG.stepSize} concurrent requests`);
  } else {
    console.log(`\nNo breaking point found up to ${CONFIG.maxConcurrency} concurrent requests`);
    console.log(`System handled maximum load successfully`);
  }

  console.log('\nPerformance Summary:');
  console.log('Concurrency | Throughput | Avg Latency | Success Rate');
  console.log('-'.repeat(60));

  metrics.steps.forEach((step) => {
    console.log(
      `${step.concurrency.toString().padEnd(11)} | ` +
        `${step.throughput.toFixed(1).padEnd(10)} | ` +
        `${step.avgLatency.toFixed(0).padEnd(11)}ms | ` +
        `${step.successRate.toFixed(1)}%`
    );
  });

  console.log('='.repeat(60));

  // Recommendations
  console.log('\nRecommendations:');
  if (metrics.breakingPoint) {
    const safeCapacity = metrics.breakingPoint - CONFIG.stepSize;
    console.log(`  - Set max concurrency to ${safeCapacity} (breaking point - 1 step)`);
    console.log(`  - Configure auto-scaling to trigger at ${Math.floor(safeCapacity * 0.7)} concurrent requests`);
    console.log(`  - Add more prover instances if higher capacity needed`);
  } else {
    console.log(`  ✓ System is highly robust`);
    console.log(`  - Current capacity exceeds ${CONFIG.maxConcurrency} concurrent requests`);
    console.log(`  - Consider increasing test max concurrency for complete assessment`);
  }

  console.log('='.repeat(60));

  process.exit(0);
}

if (require.main === module) {
  runStressTest().catch((error) => {
    console.error('Stress test error:', error);
    process.exit(1);
  });
}

module.exports = { runStressTest };
