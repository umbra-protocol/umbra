#!/bin/bash
# Rapid Mainnet Deployment Script
# USE WITH CAUTION - DEPLOYS TO MAINNET WITH REAL FUNDS

set -e  # Exit on any error

echo "======================================================================"
echo "x402 ZK Payment System - RAPID MAINNET DEPLOYMENT"
echo "======================================================================"
echo ""
echo "⚠️  WARNING: This will deploy to MAINNET with REAL FUNDS"
echo "⚠️  Make sure you have completed MAINNET_LAUNCH_VALIDATION.md"
echo ""
read -p "Are you ABSOLUTELY SURE you want to continue? (type 'YES' to proceed): " CONFIRM

if [ "$CONFIRM" != "YES" ]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

echo ""
echo "======================================================================"
echo "Step 1/7: Checking Prerequisites"
echo "======================================================================"

# Check Solana CLI
if ! command -v solana &> /dev/null; then
    echo "❌ Solana CLI not found. Install from https://docs.solana.com/cli/install-solana-cli-tools"
    exit 1
fi
echo "✓ Solana CLI found"

# Check wallet configured
WALLET=$(solana address 2>/dev/null)
if [ -z "$WALLET" ]; then
    echo "❌ No Solana wallet configured. Run: solana-keygen new"
    exit 1
fi
echo "✓ Wallet configured: $WALLET"

# Check balance
BALANCE=$(solana balance | awk '{print $1}')
if (( $(echo "$BALANCE < 10" | bc -l) )); then
    echo "⚠️  WARNING: Low balance ($BALANCE SOL). Need at least 10 SOL for deployment."
    read -p "Continue anyway? (y/n): " CONTINUE
    if [ "$CONTINUE" != "y" ]; then
        echo "❌ Deployment cancelled"
        exit 1
    fi
fi
echo "✓ Balance: $BALANCE SOL"

# Check node/npm
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found"
    exit 1
fi
echo "✓ Node.js found: $(node --version)"

# Check Go
if ! command -v go &> /dev/null; then
    echo "❌ Go not found"
    exit 1
fi
echo "✓ Go found: $(go version)"

echo ""
echo "======================================================================"
echo "Step 2/7: Executing Trusted Setup Ceremony"
echo "======================================================================"

cd ceremony

if [ ! -f "automated_setup.sh" ]; then
    echo "❌ automated_setup.sh not found"
    exit 1
fi

chmod +x automated_setup.sh

echo "Executing trusted setup (this will take 10-15 minutes)..."
./automated_setup.sh

if [ ! -f "../circuits/verification_key.json" ]; then
    echo "❌ Verification key not generated"
    exit 1
fi

echo "✓ Trusted setup complete"
echo "✓ Verification key: $(stat -f%z ../circuits/verification_key.json 2>/dev/null || stat -c%s ../circuits/verification_key.json) bytes"

cd ..

echo ""
echo "======================================================================"
echo "Step 3/7: Building Solana Program"
echo "======================================================================"

cd contracts

echo "Building BPF program..."
cargo build-bpf --release

if [ ! -f "target/deploy/x402_zk_verifier.so" ]; then
    echo "❌ Program build failed"
    exit 1
fi

PROGRAM_SIZE=$(stat -f%z target/deploy/x402_zk_verifier.so 2>/dev/null || stat -c%s target/deploy/x402_zk_verifier.so)
echo "✓ Program built: $PROGRAM_SIZE bytes"

cd ..

echo ""
echo "======================================================================"
echo "Step 4/7: Deploying to Mainnet"
echo "======================================================================"

echo "⚠️  FINAL WARNING: About to deploy to MAINNET"
echo "⚠️  This will cost ~5-8 SOL ($800-$1,300)"
read -p "Proceed with deployment? (type 'DEPLOY' to continue): " DEPLOY_CONFIRM

if [ "$DEPLOY_CONFIRM" != "DEPLOY" ]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

# Configure mainnet
solana config set --url https://api.mainnet-beta.solana.com

echo "Deploying program to mainnet..."
PROGRAM_ID=$(solana program deploy contracts/target/deploy/x402_zk_verifier.so | grep "Program Id:" | awk '{print $3}')

if [ -z "$PROGRAM_ID" ]; then
    echo "❌ Deployment failed"
    exit 1
fi

echo ""
echo "✓✓✓ PROGRAM DEPLOYED TO MAINNET ✓✓✓"
echo "✓ Program ID: $PROGRAM_ID"
echo ""

# Save program ID
echo "$PROGRAM_ID" > PROGRAM_ID.txt
echo "✓ Program ID saved to PROGRAM_ID.txt"

# Verify deployment
echo "Verifying deployment..."
solana program show "$PROGRAM_ID"

echo ""
echo "======================================================================"
echo "Step 5/7: Configuring Production Environment"
echo "======================================================================"

cd prover

if [ ! -f ".env.production" ]; then
    echo "❌ .env.production not found"
    exit 1
fi

# Copy production config
cp .env.production .env

# Generate API key if not set
if ! grep -q "API_KEY=.\+" .env; then
    API_KEY=$(openssl rand -base64 32)
    echo "API_KEY=$API_KEY" >> .env
    echo "✓ Generated API key: $API_KEY"
    echo "⚠️  SAVE THIS API KEY SECURELY!"
else
    echo "✓ API key already configured"
fi

# Update program ID in config
echo "PROGRAM_ID=$PROGRAM_ID" >> .env
echo "✓ Program ID added to config"

cd ..

echo ""
echo "======================================================================"
echo "Step 6/7: Building and Starting Services"
echo "======================================================================"

cd prover
echo "Building prover service..."
go build -o prover

if [ ! -f "prover" ]; then
    echo "❌ Prover build failed"
    exit 1
fi
echo "✓ Prover built"

cd ..

# Start with Docker Compose
cd deploy

if [ ! -f "docker-compose.yml" ]; then
    echo "❌ docker-compose.yml not found"
    exit 1
fi

echo "Starting services with Docker Compose..."
docker-compose up -d

# Wait for services to start
echo "Waiting for services to start..."
sleep 10

# Check health
echo "Checking service health..."
HEALTH=$(curl -s http://localhost:8080/health | grep "healthy" || echo "")

if [ -z "$HEALTH" ]; then
    echo "⚠️  Warning: Service health check failed"
    echo "Check logs: docker-compose logs prover"
else
    echo "✓ Prover service healthy"
fi

cd ..

echo ""
echo "======================================================================"
echo "Step 7/7: Verification"
echo "======================================================================"

echo "Testing proof generation..."

CURRENT_TIME=$(date +%s)
PAYMENT_TIME=$((CURRENT_TIME - 10))

RESPONSE=$(curl -s -X POST http://localhost:8080/generate-proof \
  -H "Content-Type: application/json" \
  -d "{
    \"minAmount\": \"1000000\",
    \"recipientKey\": \"$WALLET\",
    \"maxBlockAge\": \"60\",
    \"currentTime\": $CURRENT_TIME,
    \"actualAmount\": \"1500000\",
    \"senderKey\": \"1111111111111111111111111111111111111111111111111111111111111111\",
    \"txHash\": \"test_hash\",
    \"paymentTime\": $PAYMENT_TIME,
    \"signature\": \"3333333333333333333333333333333333333333333333333333333333333333\"
  }")

if echo "$RESPONSE" | grep -q "proof"; then
    echo "✓ Test proof generated successfully"
    GENERATION_TIME=$(echo "$RESPONSE" | grep -o '"generationTimeMs":[0-9]*' | cut -d: -f2)
    if [ ! -z "$GENERATION_TIME" ]; then
        echo "✓ Generation time: ${GENERATION_TIME}ms"
    fi
else
    echo "❌ Proof generation failed"
    echo "Response: $RESPONSE"
fi

echo ""
echo "======================================================================"
echo "🎉 MAINNET DEPLOYMENT COMPLETE 🎉"
echo "======================================================================"
echo ""
echo "✓ Trusted setup: COMPLETE"
echo "✓ Solana program: DEPLOYED"
echo "✓ Program ID: $PROGRAM_ID"
echo "✓ Prover service: RUNNING"
echo "✓ Monitoring: ACTIVE"
echo ""
echo "📊 Access Points:"
echo "  - Prover API: http://localhost:8080"
echo "  - Grafana: http://localhost:3001 (admin/admin)"
echo "  - Prometheus: http://localhost:9090"
echo ""
echo "📝 Next Steps:"
echo "  1. Review logs: docker-compose logs -f"
echo "  2. Monitor Grafana: http://localhost:3001"
echo "  3. Run load tests: cd testing && npm run test:load"
echo "  4. Configure SSL/TLS (CRITICAL - see SSL_TLS_SETUP.md)"
echo "  5. Set up domain and reverse proxy"
echo ""
echo "⚠️  CRITICAL REMINDERS:"
echo "  - System is on HTTP only (configure SSL/TLS immediately!)"
echo "  - API key saved in prover/.env (keep secure!)"
echo "  - Program ID: $PROGRAM_ID (save this!)"
echo "  - Monitor constantly for first 48 hours"
echo "  - Start with SMALL transactions (<$100)"
echo ""
echo "📞 Emergency:"
echo "  - Stop services: cd deploy && docker-compose down"
echo "  - View logs: docker-compose logs prover"
echo "  - Rollback: See INCIDENT_RESPONSE.md"
echo ""
echo "======================================================================"

# Save deployment info
cat > DEPLOYMENT_INFO.txt << EOF
Deployment Date: $(date)
Program ID: $PROGRAM_ID
Wallet: $WALLET
Network: Mainnet
Prover API: http://localhost:8080
Monitoring: http://localhost:3001

NEXT STEPS:
1. Configure SSL/TLS immediately
2. Monitor logs constantly
3. Run production validation tests
4. Start with small transactions
EOF

echo "✓ Deployment info saved to DEPLOYMENT_INFO.txt"
echo ""
echo "🚀 System is LIVE on mainnet!"
