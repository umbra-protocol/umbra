/**
 * Fuzz Testing for x402 ZK Payment System
 * Tests system with malformed, edge case, and malicious inputs
 */

const axios = require('axios');

const CONFIG = {
  proverUrl: process.env.PROVER_URL || 'http://localhost:8080',
  iterations: parseInt(process.env.FUZZ_ITERATIONS || '1000'),
};

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  bugs: [],
};

// Fuzzing strategies
const fuzzers = {
  // Random strings
  randomString: () => Math.random().toString(36).substring(2),

  // Very long strings
  longString: () => 'a'.repeat(Math.floor(Math.random() * 10000)),

  // Special characters
  specialChars: () => {
    const chars = ['<', '>', '"', "'", '&', '\n', '\r', '\t', '\0', '\x00'];
    return chars[Math.floor(Math.random() * chars.length)].repeat(
      Math.floor(Math.random() * 100)
    );
  },

  // SQL injection attempts
  sqlInjection: () => {
    const payloads = [
      "' OR '1'='1",
      "'; DROP TABLE users--",
      "1' UNION SELECT * FROM users--",
    ];
    return payloads[Math.floor(Math.random() * payloads.length)];
  },

  // XSS attempts
  xssPayload: () => {
    const payloads = [
      '<script>alert(1)</script>',
      '"><script>alert(1)</script>',
      "javascript:alert(1)",
    ];
    return payloads[Math.floor(Math.random() * payloads.length)];
  },

  // Invalid numbers
  invalidNumber: () => {
    const values = [
      'NaN',
      'Infinity',
      '-Infinity',
      '1e308',
      '-1e308',
      '0x' + 'f'.repeat(100),
    ];
    return values[Math.floor(Math.random() * values.length)];
  },

  // Negative numbers
  negativeNumber: () => (Math.random() * -1000000).toFixed(0),

  // Zero
  zero: () => '0',

  // Huge numbers
  hugeNumber: () => '9'.repeat(Math.floor(Math.random() * 100)),

  // Empty values
  empty: () => '',

  // Null/undefined
  nullish: () => [null, undefined][Math.floor(Math.random() * 2)],

  // Unicode/emoji
  unicode: () => '🚀'.repeat(Math.floor(Math.random() * 100)),

  // Buffer overflow attempts
  bufferOverflow: () => 'A'.repeat(10000),

  // Format string attacks
  formatString: () => '%s%s%s%s%s%s%s%s%s%s',

  // Path traversal
  pathTraversal: () => '../'.repeat(10) + 'etc/passwd',
};

// Generate fuzzed request
function generateFuzzedRequest() {
  const fuzzFunctions = Object.values(fuzzers);
  const randomFuzz = () =>
    fuzzFunctions[Math.floor(Math.random() * fuzzFunctions.length)]();

  const strategies = [
    // Strategy 1: Fuzz all fields
    () => ({
      minAmount: randomFuzz(),
      recipientKey: randomFuzz(),
      maxBlockAge: randomFuzz(),
      currentTime: randomFuzz(),
      actualAmount: randomFuzz(),
      senderKey: randomFuzz(),
      txHash: randomFuzz(),
      paymentTime: randomFuzz(),
      signature: randomFuzz(),
    }),

    // Strategy 2: Fuzz one field, keep others valid
    () => {
      const now = Math.floor(Date.now() / 1000);
      const valid = {
        minAmount: '1000000',
        recipientKey: '5'.repeat(32),
        maxBlockAge: '60',
        currentTime: now,
        actualAmount: '1500000',
        senderKey: '1'.repeat(32),
        txHash: 'valid_hash',
        paymentTime: now - 10,
        signature: '3'.repeat(32),
      };

      const fields = Object.keys(valid);
      const field = fields[Math.floor(Math.random() * fields.length)];
      valid[field] = randomFuzz();

      return valid;
    },

    // Strategy 3: Missing required fields
    () => {
      const partial = {};
      const fields = [
        'minAmount',
        'recipientKey',
        'maxBlockAge',
        'currentTime',
      ];
      const numFields = Math.floor(Math.random() * fields.length);

      for (let i = 0; i < numFields; i++) {
        partial[fields[i]] = '1000000';
      }

      return partial;
    },

    // Strategy 4: Extra fields
    () => {
      const now = Math.floor(Date.now() / 1000);
      return {
        minAmount: '1000000',
        recipientKey: '5'.repeat(32),
        maxBlockAge: '60',
        currentTime: now,
        actualAmount: '1500000',
        senderKey: '1'.repeat(32),
        txHash: 'valid_hash',
        paymentTime: now - 10,
        signature: '3'.repeat(32),
        extraField1: randomFuzz(),
        extraField2: randomFuzz(),
        __proto__: { polluted: true },
      };
    },

    // Strategy 5: Type confusion
    () => ({
      minAmount: [1, 2, 3],
      recipientKey: { nested: { object: true } },
      maxBlockAge: true,
      currentTime: false,
      actualAmount: () => {},
      senderKey: Symbol('test'),
      txHash: new Date(),
      paymentTime: /regex/,
      signature: Buffer.from('test'),
    }),

    // Strategy 6: Edge case numbers
    () => {
      const now = Math.floor(Date.now() / 1000);
      return {
        minAmount: fuzzers.invalidNumber(),
        recipientKey: '5'.repeat(32),
        maxBlockAge: fuzzers.negativeNumber(),
        currentTime: now + 1000000, // Far future
        actualAmount: fuzzers.zero(),
        senderKey: '1'.repeat(32),
        txHash: 'valid_hash',
        paymentTime: 0, // Unix epoch
        signature: '3'.repeat(32),
      };
    },
  ];

  const strategy = strategies[Math.floor(Math.random() * strategies.length)];
  return strategy();
}

// Test a single fuzzed request
async function testFuzzedRequest(iteration) {
  const request = generateFuzzedRequest();

  try {
    const response = await axios.post(
      `${CONFIG.proverUrl}/generate-proof`,
      request,
      {
        timeout: 5000,
        validateStatus: () => true, // Don't throw on any status
      }
    );

    // Check for unexpected behavior
    if (response.status === 200) {
      // This might be a bug - we sent invalid data but got success
      results.bugs.push({
        iteration,
        type: 'accepted_invalid_input',
        request,
        response: response.data,
      });
      return { passed: false, bug: true };
    }

    // Check response format
    if (response.status >= 500) {
      // Server error - might be a bug
      results.bugs.push({
        iteration,
        type: 'server_error',
        status: response.status,
        request,
        response: response.data,
      });
      return { passed: false, bug: true };
    }

    // 400-level errors are expected for invalid input
    if (response.status >= 400 && response.status < 500) {
      return { passed: true };
    }

    return { passed: true };
  } catch (error) {
    // Network errors, timeouts, etc. - could indicate DoS vulnerability
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      results.bugs.push({
        iteration,
        type: 'connection_issue',
        error: error.message,
        request,
      });
      return { passed: false, bug: true };
    }

    // Other errors are generally acceptable for fuzz testing
    return { passed: true };
  }
}

// Run fuzz test
async function runFuzzTest() {
  console.log('='.repeat(60));
  console.log('x402 ZK Payment System - Fuzz Test');
  console.log('='.repeat(60));
  console.log(`Iterations: ${CONFIG.iterations}`);
  console.log(`Target: ${CONFIG.proverUrl}`);
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

  console.log('Starting fuzz test...\n');

  const startTime = Date.now();

  for (let i = 0; i < CONFIG.iterations; i++) {
    results.total++;
    const result = await testFuzzedRequest(i);

    if (result.passed) {
      results.passed++;
    } else {
      results.failed++;
    }

    // Progress
    if ((i + 1) % 100 === 0) {
      console.log(
        `Progress: ${i + 1}/${CONFIG.iterations} (${results.bugs.length} potential bugs found)`
      );
    }
  }

  const duration = (Date.now() - startTime) / 1000;

  // Results
  console.log('\n' + '='.repeat(60));
  console.log('Fuzz Test Results');
  console.log('='.repeat(60));
  console.log(`\nDuration: ${duration.toFixed(1)}s`);
  console.log(`Total iterations: ${results.total}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Potential bugs: ${results.bugs.length}`);

  if (results.bugs.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('Potential Bugs Found:');
    console.log('='.repeat(60));

    const bugTypes = {};
    results.bugs.forEach((bug) => {
      bugTypes[bug.type] = (bugTypes[bug.type] || 0) + 1;
    });

    console.log('\nBug Summary:');
    Object.entries(bugTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

    console.log('\nDetailed Bug Reports:');
    results.bugs.slice(0, 10).forEach((bug, index) => {
      console.log(`\nBug #${index + 1}:`);
      console.log(`  Type: ${bug.type}`);
      console.log(`  Iteration: ${bug.iteration}`);
      console.log(`  Request:`, JSON.stringify(bug.request).substring(0, 200));
      if (bug.response) {
        console.log(`  Response:`, JSON.stringify(bug.response).substring(0, 200));
      }
    });

    if (results.bugs.length > 10) {
      console.log(`\n... and ${results.bugs.length - 10} more bugs`);
    }
  } else {
    console.log('\n✓ No bugs found!');
    console.log('System properly handles malformed input');
  }

  console.log('\n' + '='.repeat(60));

  // Assessment
  console.log('\nSecurity Assessment:');
  const bugRate = (results.bugs.length / results.total) * 100;

  if (results.bugs.length === 0) {
    console.log('  ✓ Excellent - No vulnerabilities found');
  } else if (bugRate < 1) {
    console.log('  ⚠ Good - Few potential issues (<1%)');
  } else if (bugRate < 5) {
    console.log('  ⚠ Fair - Some issues found (1-5%)');
  } else {
    console.log('  ✗ Poor - Many issues found (>5%)');
  }

  console.log('='.repeat(60));

  // Save detailed report
  const fs = require('fs');
  fs.writeFileSync(
    'fuzz_test_report.json',
    JSON.stringify(results, null, 2)
  );
  console.log('\n✓ Detailed report saved to fuzz_test_report.json');

  if (results.bugs.length > 0) {
    console.log('\n⚠ Review bugs and fix before production deployment');
    process.exit(1);
  }

  console.log('\n✓ Fuzz test passed');
  process.exit(0);
}

if (require.main === module) {
  runFuzzTest().catch((error) => {
    console.error('Fuzz test error:', error);
    process.exit(1);
  });
}

module.exports = { runFuzzTest };
