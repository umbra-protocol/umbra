#!/bin/bash

# x402 ZK Payments Production Deployment Script

set -e

echo "======================================"
echo "x402 ZK Payment System Deployment"
echo "======================================"

# Configuration
ENV=${1:-production}
echo "Environment: $ENV"

# Check prerequisites
echo ""
echo "Checking prerequisites..."

command -v docker >/dev/null 2>&1 || { echo "Error: docker is required"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "Error: docker-compose is required"; exit 1; }
command -v solana >/dev/null 2>&1 || { echo "Error: solana CLI is required"; exit 1; }

echo "✓ All prerequisites met"

# Load environment variables
if [ -f ".env.$ENV" ]; then
    echo "Loading environment from .env.$ENV"
    export $(cat .env.$ENV | grep -v '^#' | xargs)
else
    echo "Error: .env.$ENV not found"
    exit 1
fi

# Build circuits
echo ""
echo "======================================"
echo "Step 1: Building Circuits"
echo "======================================"

cd ../circuits
if [ ! -f "build/payment_proof_final.zkey" ]; then
    echo "Running trusted setup..."
    npm run build-all
else
    echo "✓ Circuits already built"
fi

# Export verification keys
npm run export-rust
cp build/vkey_constants.rs ../contracts/src/

echo "✓ Circuits ready"

# Build Solana program
echo ""
echo "======================================"
echo "Step 2: Building Solana Program"
echo "======================================"

cd ../contracts
cargo build-bpf --release

echo "✓ Solana program built"

# Deploy Solana program (if not already deployed)
if [ -z "$VERIFIER_PROGRAM_ID" ]; then
    echo ""
    echo "Deploying Solana program to $SOLANA_CLUSTER..."
    solana config set --url $SOLANA_RPC_URL

    PROGRAM_ID=$(solana program deploy target/deploy/x402_zk_verifier.so --output json | jq -r '.programId')

    echo "Program deployed: $PROGRAM_ID"
    echo "VERIFIER_PROGRAM_ID=$PROGRAM_ID" >> ../.env.$ENV
    export VERIFIER_PROGRAM_ID=$PROGRAM_ID
else
    echo "✓ Using existing program: $VERIFIER_PROGRAM_ID"
fi

# Build SDK
echo ""
echo "======================================"
echo "Step 3: Building SDK"
echo "======================================"

cd ../sdk
npm install
npm run build

echo "✓ SDK built"

# Build Docker images
echo ""
echo "======================================"
echo "Step 4: Building Docker Images"
echo "======================================"

cd ../deploy

echo "Building prover image..."
docker-compose build prover-1

echo "Building server image..."
docker-compose build server

echo "✓ Docker images built"

# Start services
echo ""
echo "======================================"
echo "Step 5: Starting Services"
echo "======================================"

docker-compose up -d

echo "Waiting for services to start..."
sleep 10

# Health checks
echo ""
echo "======================================"
echo "Step 6: Health Checks"
echo "======================================"

check_service() {
    local name=$1
    local url=$2
    local max_attempts=30
    local attempt=1

    echo -n "Checking $name..."

    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$url" > /dev/null; then
            echo " ✓"
            return 0
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done

    echo " ✗ Failed"
    return 1
}

check_service "Prover 1" "http://localhost:8080/health"
check_service "Prover 2" "http://localhost:8081/health"
check_service "Server" "http://localhost:3000/health"
check_service "Prometheus" "http://localhost:9090/-/healthy"
check_service "Grafana" "http://localhost:3001/api/health"

echo ""
echo "======================================"
echo "Deployment Summary"
echo "======================================"

echo "Environment: $ENV"
echo "Solana RPC: $SOLANA_RPC_URL"
echo "Verifier Program: $VERIFIER_PROGRAM_ID"
echo ""
echo "Services:"
echo "  - Prover 1:    http://localhost:8080"
echo "  - Prover 2:    http://localhost:8081"
echo "  - x402 Server: http://localhost:3000"
echo "  - Prometheus:  http://localhost:9090"
echo "  - Grafana:     http://localhost:3001"
echo ""
echo "Metrics:"
echo "  - Prover metrics: http://localhost:8080/metrics"
echo "  - Cache stats:    http://localhost:8080/cache/stats"
echo ""
echo "✓ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Configure Grafana dashboards"
echo "2. Set up SSL certificates"
echo "3. Configure domain DNS"
echo "4. Set up backup systems"
echo "5. Enable monitoring alerts"
echo ""
echo "To stop: docker-compose down"
echo "To view logs: docker-compose logs -f"
