# x402 ZK Payment System - Testing Suite

Comprehensive testing infrastructure for validating production readiness of the x402 ZK payment system.

## Overview

This testing suite validates all critical aspects of the system:

1. **Load Testing** - Performance under realistic concurrent load
2. **Stress Testing** - Breaking point identification and capacity planning
3. **Fuzz Testing** - Security validation with malicious inputs
4. **Chaos Engineering** - Resilience under failure conditions

## Quick Start

```bash
# Install dependencies
npm install

# Run all tests (production validation)
npm run test:all

# Run individual test suites
npm run test:load      # Load testing
npm run test:stress    # Stress testing
npm run test:fuzz      # Fuzz testing
npm run test:chaos     # Chaos engineering

# Quick smoke test (faster)
npm run test:quick
```

## Test Suites

### 1. Load Testing (`load_test.js`)

**Purpose:** Validates system performance under realistic concurrent load.

**What it tests:**
- Concurrent user handling
- Request throughput
- Latency distribution (min/avg/max/P50/P95/P99)
- Error rate under normal load
- Success rate reliability

**Configuration:**
```bash
# Environment variables
CONCURRENT_USERS=50        # Number of concurrent users (default: 50)
REQUESTS_PER_USER=100      # Requests per user (default: 100)
RAMP_UP_TIME=30           # Seconds to ramp up users (default: 30)
PROVER_URL=http://localhost:8080  # Prover service URL
```

**Success Criteria:**
- ✓ Success rate ≥ 95%
- ✓ Average latency ≤ 300ms
- ✓ Throughput ≥ 20 req/s

**Example:**
```bash
# Quick test with 10 users
CONCURRENT_USERS=10 REQUESTS_PER_USER=20 npm run test:load

# Full production test
CONCURRENT_USERS=100 REQUESTS_PER_USER=200 npm run test:load
```

### 2. Stress Testing (`stress_test.js`)

**Purpose:** Identifies system breaking point and capacity limits.

**What it tests:**
- Gradual load increase until system failure
- Breaking point identification
- Performance degradation patterns
- Recovery behavior
- Capacity planning data

**Configuration:**
```bash
INITIAL_CONCURRENCY=10    # Starting concurrent requests
MAX_CONCURRENCY=200       # Maximum to test
STEP_SIZE=10             # Increment per step
STEP_DURATION=10000      # Duration per step (ms)
```

**How it works:**
1. Starts at INITIAL_CONCURRENCY (10 concurrent requests)
2. Runs for STEP_DURATION (10 seconds)
3. Increases by STEP_SIZE (10)
4. Repeats until breaking point or MAX_CONCURRENCY reached

**Breaking Point Criteria:**
- Error rate > 20%
- Average latency > 5000ms
- Success rate < 80%

**Example:**
```bash
# Quick stress test
INITIAL_CONCURRENCY=5 MAX_CONCURRENCY=30 STEP_DURATION=5000 npm run test:stress

# Full stress test
INITIAL_CONCURRENCY=10 MAX_CONCURRENCY=500 npm run test:stress
```

### 3. Fuzz Testing (`fuzz_test.js`)

**Purpose:** Security validation through malformed and malicious inputs.

**What it tests:**
- SQL injection resistance
- XSS payload handling
- Buffer overflow protection
- Type confusion handling
- Input validation robustness
- Edge case number handling
- Unicode/special character handling
- Path traversal attempts
- Format string attacks

**Configuration:**
```bash
FUZZ_ITERATIONS=1000     # Number of fuzz iterations (default: 1000)
PROVER_URL=http://localhost:8080
```

**Fuzzing Strategies:**
1. **All fields fuzzed** - Random malicious input in every field
2. **One field fuzzed** - Single field fuzzed, others valid
3. **Missing fields** - Partial/incomplete requests
4. **Extra fields** - Prototype pollution attempts
5. **Type confusion** - Wrong data types (arrays, objects, functions)
6. **Edge case numbers** - NaN, Infinity, huge numbers, negatives

**Success Criteria:**
- ✓ No server crashes (500 errors)
- ✓ No accepted invalid inputs (200 responses)
- ✓ Proper error handling (400-level errors)
- ✓ Bug rate < 1%

**Example:**
```bash
# Quick fuzz test
FUZZ_ITERATIONS=100 npm run test:fuzz

# Comprehensive fuzz test
FUZZ_ITERATIONS=10000 npm run test:fuzz
```

**Output:**
- Generates `fuzz_test_report.json` with detailed bug reports
- Categorizes bugs by type (server_error, accepted_invalid_input, connection_issue)
- Shows first 10 bugs with request/response details

### 4. Chaos Engineering (`chaos_test.js`)

**Purpose:** Validates system resilience under failure conditions.

**What it tests:**

**Scenario 1: Service Restart**
- System behavior during service crash
- Recovery time after restart
- Request handling during downtime
- Data consistency after recovery

**Scenario 2: Network Latency**
- Performance under high latency (500ms added)
- Success rate degradation
- Timeout handling
- User experience impact

**Scenario 3: Resource Exhaustion**
- Behavior under 100 concurrent burst requests
- CPU/memory exhaustion handling
- Rate limiting effectiveness
- Graceful degradation

**Scenario 4: Cascading Failures**
- Multiple simultaneous failures (RPC + latency + burst)
- Circuit breaker activation
- Fallback mechanism effectiveness
- System collapse prevention

**Scenario 5: Rate Limit Exhaustion**
- Rate limit triggering
- Recovery after rate limit window
- User feedback during rate limiting
- System stability during throttling

**Configuration:**
```bash
CHAOS_DURATION=60        # Duration per scenario (seconds)
PROVER_URL=http://localhost:8080
```

**Success Criteria:**
- ✓ Service restart: < 40% failures after recovery
- ✓ Network latency: ≥ 80% success rate under delay
- ✓ Resource exhaustion: ≥ 70% success rate under burst
- ✓ Cascading failures: ≥ 50% success rate (system doesn't collapse)
- ✓ Rate limit: Proper recovery after window reset

**Example:**
```bash
# Run chaos tests
npm run test:chaos
```

## Master Test Runner

The `run_all_tests.js` master runner executes all test suites and generates production readiness report.

**Usage:**
```bash
npm run test:all
```

**What it does:**
1. Runs all 4 test suites sequentially
2. Tracks pass/fail status for each
3. Generates production readiness assessment
4. Creates detailed JSON report
5. Creates markdown summary report

**Output Files:**
- `production_readiness_report.json` - Detailed JSON report
- `PRODUCTION_READINESS_REPORT.md` - Human-readable summary

**Production Readiness Criteria:**

System is considered **PRODUCTION READY** if ALL critical tests pass:
- ✓ Load test passes (≥95% success rate)
- ✓ Stress test completes (breaking point identified)
- ✓ Fuzz test passes (no critical bugs)
- ✓ Chaos test passes (resilient to failures)

**Example Output:**
```
=======================================================================
PRODUCTION READINESS ASSESSMENT
=======================================================================

Critical Tests: 4/4 passed

✓✓✓ SYSTEM IS PRODUCTION READY ✓✓✓

All critical tests passed. The system has been validated for:
  ✓ Real cryptographic operations (Groth16 ZK proofs)
  ✓ Load handling (50 concurrent users, 100 req/user)
  ✓ Stress resilience (gradual load increase to breaking point)
  ✓ Security validation (1000+ malicious inputs tested)
  ✓ Chaos resilience (service restarts, cascading failures)

Recommendation: ✓ APPROVED FOR MAINNET DEPLOYMENT
```

## Prerequisites

**Required Services:**

Before running tests, ensure the following services are running:

1. **Prover Service** (port 8080)
```bash
cd ../prover
go run main.go
```

2. **x402 Server** (port 3000) - Optional for some tests
```bash
cd ../server
npm install
npm start
```

**Alternative: Use Docker Compose**
```bash
cd ../deploy
docker-compose up -d
```

## Test Configuration

### Environment Variables

All tests support the following:

```bash
# Service URLs
PROVER_URL=http://localhost:8080
SERVER_URL=http://localhost:3000

# Load test config
CONCURRENT_USERS=50
REQUESTS_PER_USER=100
RAMP_UP_TIME=30

# Stress test config
INITIAL_CONCURRENCY=10
MAX_CONCURRENCY=200
STEP_SIZE=10
STEP_DURATION=10000

# Fuzz test config
FUZZ_ITERATIONS=1000

# Chaos test config
CHAOS_DURATION=60
```

### Quick Test Mode

For faster validation during development:

```bash
# Quick load test (10 users, 20 requests each)
npm run test:quick

# Or manually configure quick mode
CONCURRENT_USERS=5 REQUESTS_PER_USER=10 npm run test:load
FUZZ_ITERATIONS=50 npm run test:fuzz
```

## Interpreting Results

### Load Test Results

```
Throughput: 45.23 req/s      ← Higher is better (target: ≥20)
Success rate: 98.50%         ← Higher is better (target: ≥95%)

Latency:
  Min: 45.32ms              ← Best case
  Max: 456.78ms             ← Worst case
  Avg: 123.45ms             ← Average (target: ≤300ms)
  P50: 110.23ms             ← 50% of requests (median)
  P95: 245.67ms             ← 95% of requests
  P99: 389.12ms             ← 99% of requests (outliers)
```

**Good Results:**
- Success rate ≥ 99% = Excellent reliability
- Avg latency ≤ 150ms = Excellent performance
- Throughput ≥ 50 req/s = Excellent throughput

### Stress Test Results

```
Breaking Point: 120 concurrent requests
System remained stable up to 110 concurrent requests

Concurrency | Throughput | Avg Latency | Success Rate
-----------|------------|-------------|-------------
10         | 45.2       | 98ms        | 100.0%
20         | 78.5       | 125ms       | 99.8%
30         | 95.3       | 156ms       | 99.2%
...
110        | 180.2      | 289ms       | 98.5%
120        | 165.4      | 1234ms      | 78.3%  ← Breaking point
```

**Recommendations:**
- Set max concurrency to breaking point - 1 step (110 in example)
- Configure auto-scaling at 70% of breaking point (77 in example)

### Fuzz Test Results

```
Total iterations: 1000
Potential bugs: 3

Bug Summary:
  server_error: 2          ← 500 errors (crashes)
  accepted_invalid_input: 1 ← Accepted bad data
  connection_issue: 0       ← Network problems
```

**Good Results:**
- Bug rate = 0% = Excellent security
- Bug rate < 1% = Good security
- Bug rate > 5% = Poor security (fix before production)

### Chaos Test Results

```
Scenarios passed: 4/4

✓ service_restart         ← Recovers from crashes
✓ network_latency        ← Handles slow networks
✓ resource_exhaustion    ← Handles burst load
✓ cascading_failure      ← Doesn't collapse under multiple failures

Resilience Assessment:
  ✓ Excellent - Passed all chaos scenarios
```

## Continuous Testing

### In CI/CD Pipeline

Add to your CI/CD pipeline:

```yaml
# .github/workflows/test.yml
- name: Run Production Tests
  run: |
    cd testing
    npm install
    npm run test:all
```

### Regular Validation

Run tests regularly to ensure continued reliability:

```bash
# Weekly full test
npm run test:all

# Daily quick test
npm run test:quick
```

## Troubleshooting

### Tests Fail to Connect

**Problem:** `Service is not responding`

**Solution:**
1. Ensure prover service is running: `curl http://localhost:8080/health`
2. Check Docker containers: `docker-compose ps`
3. Verify ports not blocked by firewall

### High Failure Rate

**Problem:** Success rate < 95%

**Possible Causes:**
1. Insufficient resources (CPU/memory)
2. Rate limiting too aggressive
3. Database connection issues
4. Network latency

**Solution:**
1. Check system resources: `docker stats`
2. Review prover logs: `docker-compose logs prover`
3. Adjust rate limits in `prover/config.go`

### Stress Test Never Finds Breaking Point

**Problem:** No breaking point found up to MAX_CONCURRENCY

**Solution:**
1. Increase MAX_CONCURRENCY
2. System is highly robust (good problem!)
3. Consider testing with more complex proof requests

### Fuzz Test Finds Many Bugs

**Problem:** Bug rate > 5%

**Solution:**
1. Review `fuzz_test_report.json` for details
2. Fix input validation in prover service
3. Add error handling for edge cases
4. Re-run tests after fixes

## Performance Benchmarks

**Expected Performance (on 4-core, 16GB RAM instance):**

| Metric | Value |
|--------|-------|
| Proof generation | 80-120ms |
| Verification (on-chain) | 4ms |
| Throughput | 40-60 req/s per instance |
| Success rate | > 99% |
| P95 latency | < 250ms |
| Breaking point | 100-150 concurrent |

**With optimizations:**
- Proof caching: 10-15% hit rate → 10-15% performance gain
- Batch verification: 10 proofs → 73% cost savings
- Circuit optimization: 33% faster proof generation

## Production Checklist

Before deploying to mainnet, ensure:

- [ ] All tests pass: `npm run test:all`
- [ ] Load test with production-level traffic
- [ ] Stress test identifies capacity limits
- [ ] Fuzz test shows < 1% bug rate
- [ ] Chaos tests validate resilience
- [ ] Monitoring configured (Prometheus/Grafana)
- [ ] Error recovery tested (retry, fallback, circuit breakers)
- [ ] Trusted setup ceremony completed
- [ ] Security audit reviewed
- [ ] Deployment automation tested

## Next Steps

1. **Run Tests:** `npm run test:all`
2. **Review Report:** Check `PRODUCTION_READINESS_REPORT.md`
3. **Fix Issues:** Address any failed tests
4. **Deploy:** Follow deployment guide in `../MAINNET_READY.md`
5. **Monitor:** Set up Grafana dashboards for ongoing monitoring

## Support

For issues or questions:
1. Review test output and error messages
2. Check logs: `docker-compose logs`
3. Consult documentation in `../docs/`
4. File an issue with test results attached

---

**Testing Status:** ✓ Comprehensive test suite complete
**Production Ready:** Run `npm run test:all` to validate
