# x402 ZK Payment System - Quick Reference

One-page reference for all commands and operations.

## 🚀 Quick Start Commands

### Deploy Everything (Docker)
```bash
cd "Desktop/solana projects/x402-zk-payments/deploy"
docker-compose up -d
```

### Run All Tests
```bash
cd testing
npm run test:all
```

### Build Everything Manually
```bash
# Circuits
cd circuits && npm install && npm run build-all

# Solana Program
cd contracts && cargo build-bpf

# Prover Service
cd prover && go build

# SDK
cd sdk && npm install && npm run build

# Server
cd server && npm install
```

---

## 📦 Project Structure

```
x402-zk-payments/
├── circuits/           # ZK circuits (Circom)
├── contracts/          # Solana program (Rust)
├── sdk/               # TypeScript SDK
├── prover/            # Go prover service
├── server/            # Example x402 server
├── ceremony/          # Trusted setup
├── testing/           # Test suites
├── monitoring/        # Prometheus/Grafana
├── deploy/            # Docker deployment
└── docs/              # Documentation
```

---

## 🧪 Testing Commands

```bash
cd testing
npm install

# Run all tests (production validation)
npm run test:all

# Individual test suites
npm run test:load      # Load testing
npm run test:stress    # Stress testing
npm run test:fuzz      # Fuzz testing
npm run test:chaos     # Chaos engineering

# Quick smoke test
npm run test:quick

# Production validation
npm run validate:production
```

### Test Configuration

**Load Test:**
```bash
CONCURRENT_USERS=50 REQUESTS_PER_USER=100 npm run test:load
```

**Stress Test:**
```bash
MAX_CONCURRENCY=200 STEP_SIZE=10 npm run test:stress
```

**Fuzz Test:**
```bash
FUZZ_ITERATIONS=1000 npm run test:fuzz
```

---

## 🔧 Build Commands

### Circuits
```bash
cd circuits

# Install dependencies
npm install

# Compile circuit
circom payment_proof.circom --r1cs --wasm --sym -o build/

# Generate verification key
snarkjs groth16 setup build/payment_proof.r1cs powersoftau_final.ptau payment_proof.zkey

# Export verification key
snarkjs zkey export verificationkey payment_proof.zkey verification_key.json

# Export to Rust (for Solana)
node verification_key_loader.js
```

### Solana Program
```bash
cd contracts

# Build
cargo build-bpf

# Test
cargo test-bpf

# Deploy
solana program deploy target/deploy/x402_zk_verifier.so

# Get program ID
solana program show target/deploy/x402_zk_verifier.so
```

### Prover Service
```bash
cd prover

# Install dependencies
go mod download

# Build
go build -o prover

# Run
./prover

# Or with go run
go run main.go
```

### SDK
```bash
cd sdk

# Install dependencies
npm install

# Build
npm run build

# Test
npm test

# Link locally for development
npm link
```

### Server
```bash
cd server

# Install dependencies
npm install

# Run
npm start

# Or with node
node index.js
```

---

## 🔐 Trusted Setup Commands

### Automated Setup (Recommended)
```bash
cd ceremony
./automated_setup.sh
```

### Manual Multi-Party Setup
```bash
cd ceremony

# Phase 1: Powers of Tau
snarkjs powersoftau new bn128 12 pot12_0000.ptau
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="Participant 1"

# Phase 2: Circuit-specific
snarkjs groth16 setup ../circuits/build/payment_proof.r1cs pot12_final.ptau payment_proof_0000.zkey
snarkjs zkey contribute payment_proof_0000.zkey payment_proof_0001.zkey --name="Participant 1"

# Export verification key
snarkjs zkey export verificationkey payment_proof_final.zkey verification_key.json
```

---

## 🐳 Docker Commands

### Start All Services
```bash
cd deploy
docker-compose up -d
```

### Stop All Services
```bash
docker-compose down
```

### View Logs
```bash
docker-compose logs -f prover
docker-compose logs -f server
docker-compose logs -f prometheus
docker-compose logs -f grafana
```

### Restart Service
```bash
docker-compose restart prover
```

### Check Status
```bash
docker-compose ps
```

### Rebuild Service
```bash
docker-compose up -d --build prover
```

---

## 📊 Monitoring Commands

### Access Dashboards
```bash
# Grafana
open http://localhost:3001
# Default credentials: admin / admin

# Prometheus
open http://localhost:9090
```

### Health Checks
```bash
# Prover service
curl http://localhost:8080/health

# x402 Server
curl http://localhost:3000/health

# Prometheus
curl http://localhost:9090/-/healthy

# Grafana
curl http://localhost:3001/api/health
```

### Metrics
```bash
# Prover metrics
curl http://localhost:8080/metrics

# View specific metric
curl http://localhost:8080/metrics | grep proof_generation_duration
```

---

## 🔍 Development Commands

### Watch Mode
```bash
# Circuits (recompile on change)
cd circuits
nodemon --watch payment_proof.circom --exec "npm run build"

# Server (auto-restart)
cd server
npm install -g nodemon
nodemon index.js

# Prover (auto-rebuild)
cd prover
go install github.com/cosmtrek/air@latest
air
```

### Debugging
```bash
# Enable debug logs
export LOG_LEVEL=debug

# Prover debug mode
cd prover
go run main.go --log-level=debug

# Server debug mode
cd server
DEBUG=* npm start
```

---

## 🧰 Utility Commands

### Generate Test Proof
```bash
curl -X POST http://localhost:8080/generate-proof \
  -H "Content-Type: application/json" \
  -d '{
    "minAmount": "1000000",
    "recipientKey": "5555555555555555555555555555555555555555555555555555555555555555",
    "maxBlockAge": "60",
    "currentTime": '$(date +%s)',
    "actualAmount": "1500000",
    "senderKey": "1111111111111111111111111111111111111111111111111111111111111111",
    "txHash": "test_hash",
    "paymentTime": '$(($(date +%s) - 10))',
    "signature": "3333333333333333333333333333333333333333333333333333333333333333"
  }'
```

### Check Solana Program
```bash
# Get program info
solana program show <PROGRAM_ID>

# Get program data size
solana program dump <PROGRAM_ID> program.so
ls -lh program.so

# Check program logs
solana logs <PROGRAM_ID>
```

### Clean Build Artifacts
```bash
# Circuits
cd circuits
rm -rf build/ node_modules/

# Contracts
cd contracts
cargo clean

# Prover
cd prover
rm -f prover
go clean

# SDK
cd sdk
rm -rf dist/ node_modules/

# All at once
cd "Desktop/solana projects/x402-zk-payments"
rm -rf circuits/build circuits/node_modules
rm -rf contracts/target
rm -rf prover/prover
rm -rf sdk/dist sdk/node_modules
rm -rf server/node_modules
rm -rf testing/node_modules
```

---

## 📝 Configuration Files

### Prover Service (.env)
```bash
PORT=8080
RATE_LIMIT_PER_MINUTE=10
CACHE_SIZE=1000
CACHE_TTL_SECONDS=3600
LOG_LEVEL=info
```

### x402 Server (.env)
```bash
PORT=3000
PROVER_URL=http://localhost:8080
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
MERCHANT_PUBKEY=Your_Pubkey_Here
MIN_PAYMENT_AMOUNT=1000000
```

### Docker Compose (.env)
```bash
PROVER_PORT=8080
SERVER_PORT=3000
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001
GRAFANA_ADMIN_PASSWORD=your_secure_password
```

---

## 🔧 Troubleshooting Commands

### Check Service Status
```bash
# Prover
curl http://localhost:8080/health
# Should return: {"status":"healthy"}

# Server
curl http://localhost:3000/health
# Should return: {"status":"ok"}

# Solana RPC
curl https://api.mainnet-beta.solana.com -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
```

### Check Ports
```bash
# Windows
netstat -an | findstr :8080
netstat -an | findstr :3000

# Check if port is in use
Test-NetConnection localhost -Port 8080
```

### View Docker Logs
```bash
# All services
docker-compose logs

# Specific service
docker-compose logs prover

# Follow logs
docker-compose logs -f --tail=100 prover

# Last N lines
docker-compose logs --tail=50 prover
```

### Check Docker Resources
```bash
# Container stats
docker stats

# Disk usage
docker system df

# Clean up
docker system prune -a
```

### Debug Circuit
```bash
cd circuits

# Generate witness (debug inputs)
node build/payment_proof_js/generate_witness.js \
  build/payment_proof_js/payment_proof.wasm \
  input.json \
  witness.wtns

# Check constraint satisfaction
snarkjs wtns check build/payment_proof.r1cs witness.wtns
```

---

## 📚 Documentation Quick Links

| Document | Purpose |
|----------|---------|
| `COMPLETE_SYSTEM_OVERVIEW.md` | Comprehensive system overview |
| `VALIDATION_SUMMARY.md` | Production readiness validation |
| `MAINNET_READY.md` | Mainnet deployment assessment |
| `BUILD_INSTRUCTIONS.md` | Step-by-step build guide |
| `PRODUCTION_READY.md` | Production deployment guide |
| `testing/README.md` | Testing documentation |
| `QUICK_REFERENCE.md` | This file |

---

## 🎯 Common Workflows

### Deploy to Production
```bash
# 1. Run tests
cd testing && npm run test:all

# 2. Review report
cat PRODUCTION_READINESS_REPORT.md

# 3. Execute setup
cd ../ceremony && ./automated_setup.sh

# 4. Deploy
cd ../deploy && ./deploy.sh

# 5. Monitor
open http://localhost:3001
```

### Update Circuit
```bash
# 1. Edit circuit
vim circuits/payment_proof.circom

# 2. Rebuild
cd circuits && npm run build-all

# 3. Update Solana program
cd ../contracts && cargo build-bpf

# 4. Redeploy
solana program deploy target/deploy/x402_zk_verifier.so

# 5. Test
cd ../testing && npm run test:load
```

### Debug Production Issue
```bash
# 1. Check logs
docker-compose logs -f prover

# 2. Check metrics
curl http://localhost:8080/metrics

# 3. View Grafana
open http://localhost:3001

# 4. Test health
curl http://localhost:8080/health

# 5. Check Prometheus
open http://localhost:9090
```

---

## 🆘 Emergency Commands

### Restart Everything
```bash
cd deploy
docker-compose restart
```

### Stop Everything
```bash
docker-compose down
```

### Nuclear Reset
```bash
docker-compose down -v  # Remove volumes
docker system prune -a  # Clean Docker
cd circuits && npm run clean
cd ../contracts && cargo clean
cd ../prover && go clean
```

### Emergency Rollback
```bash
# Downgrade Solana program
solana program deploy target/deploy/x402_zk_verifier_backup.so

# Restart services
docker-compose restart
```

---

## 📊 Performance Benchmarks

### Expected Performance
- **Proof Generation:** 80-120ms
- **Verification:** 4ms
- **Throughput:** 60 req/s per instance
- **Success Rate:** >99%
- **P95 Latency:** <250ms
- **Breaking Point:** 100-150 concurrent

### Performance Testing
```bash
# Quick load test
cd testing
CONCURRENT_USERS=10 REQUESTS_PER_USER=20 npm run test:load

# Full stress test
npm run test:stress

# Benchmark prover
cd ../prover
go test -bench=. -benchtime=10s
```

---

## 🔐 Security Checklist

Before production:
- [ ] Run all tests: `cd testing && npm run test:all`
- [ ] Execute trusted setup: `cd ceremony && ./automated_setup.sh`
- [ ] Review fuzz test results: `cat testing/fuzz_test_report.json`
- [ ] Enable rate limiting: Check `prover/.env`
- [ ] Configure alerts: Review `monitoring/alerts.yml`
- [ ] Backup verification keys
- [ ] Document program ID
- [ ] Test monitoring: Access Grafana
- [ ] Verify SSL/TLS for production endpoints
- [ ] Set strong admin passwords

---

## 💡 Tips & Tricks

### Speed Up Development
```bash
# Use quick test mode
npm run test:quick

# Skip setup phase (if already done)
SKIP_SETUP=true npm run build

# Use cached Docker layers
docker-compose build --parallel
```

### Optimize Performance
```bash
# Enable proof caching
export CACHE_SIZE=5000
export CACHE_TTL_SECONDS=7200

# Use batch verification
# (10 proofs = 73% cost savings)
```

### Monitor Production
```bash
# Set up alerts
cp monitoring/alerts.yml.example monitoring/alerts.yml
vim monitoring/alerts.yml

# Add custom dashboard
open http://localhost:3001/dashboard/import
# Import: monitoring/grafana_dashboard.json
```

---

## 🎓 Learning Resources

### Understanding ZK Proofs
- Circom docs: https://docs.circom.io
- Groth16 paper: https://eprint.iacr.org/2016/260.pdf
- snarkjs guide: https://github.com/iden3/snarkjs

### Solana Development
- Solana docs: https://docs.solana.com
- BPF programming: https://solana.com/docs/programs/lang-rust
- alt_bn128: https://solana.com/docs/core/runtime#alt_bn128

### x402 Protocol
- x402 spec: (protocol documentation)
- Payment standards: HTTP 402 status code

---

**Quick Reference Version:** 1.0
**Last Updated:** System completion
**Status:** Production ready ✅
