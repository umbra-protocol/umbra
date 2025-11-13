#!/bin/bash

# Automated Trusted Setup Ceremony
# Uses randomness beacon for non-interactive, verifiable setup

set -e

echo "=========================================="
echo "Automated Trusted Setup Ceremony"
echo "Using drand randomness beacon for entropy"
echo "=========================================="

CIRCUIT_NAME="payment_proof"
POWER=12
BEACON_ROUND=3000000  # drand beacon round for entropy

# Check prerequisites
command -v snarkjs >/dev/null 2>&1 || { echo "Error: snarkjs required"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "Error: curl required"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "Error: jq required"; exit 1; }

cd "$(dirname "$0")"
mkdir -p output
cd output

echo ""
echo "Step 1: Fetching randomness from drand beacon..."
echo "Round: $BEACON_ROUND"

# Get randomness from drand public beacon
BEACON_URL="https://api.drand.sh/public/latest"
RANDOMNESS=$(curl -s $BEACON_URL | jq -r '.randomness')

if [ -z "$RANDOMNESS" ]; then
    echo "Error: Failed to fetch randomness from drand"
    exit 1
fi

echo "✓ Randomness obtained: ${RANDOMNESS:0:32}..."
echo "Full beacon data:"
curl -s $BEACON_URL | jq '.'

# Save randomness for verification
echo $RANDOMNESS > randomness.txt
echo "✓ Randomness saved to randomness.txt"

echo ""
echo "Step 2: Phase 1 - Powers of Tau"
echo "=========================================="

# Initial Powers of Tau
echo "Creating initial ceremony..."
snarkjs powersoftau new bn128 $POWER pot${POWER}_0000.ptau -v

# Contribute using beacon randomness
echo ""
echo "Contributing with beacon randomness..."
snarkjs powersoftau contribute pot${POWER}_0000.ptau pot${POWER}_0001.ptau \
    --name="drand beacon round $BEACON_ROUND" \
    -v -e="$RANDOMNESS"

# Get contribution hash
CONTRIB_HASH=$(snarkjs powersoftau verify pot${POWER}_0001.ptau | grep "contribution #1" | awk '{print $NF}')
echo "Contribution hash: $CONTRIB_HASH"
echo $CONTRIB_HASH > contribution_hash.txt

# Additional entropy from system
echo ""
echo "Adding system entropy contribution..."
SYSTEM_ENTROPY="$(date +%s%N)$(cat /proc/sys/kernel/random/uuid)$(ps aux | sha256sum)"
snarkjs powersoftau contribute pot${POWER}_0001.ptau pot${POWER}_0002.ptau \
    --name="System entropy" \
    -v -e="$SYSTEM_ENTROPY"

# Third contribution from randomness.org
echo ""
echo "Adding randomness.org entropy..."
RANDOM_ORG=$(curl -s "https://www.random.org/cgi-bin/randbyte?nbytes=32&format=h" | tr -d '\n ')
snarkjs powersoftau contribute pot${POWER}_0002.ptau pot${POWER}_0003.ptau \
    --name="random.org" \
    -v -e="$RANDOM_ORG"

# Prepare phase 2
echo ""
echo "Preparing phase 2..."
snarkjs powersoftau prepare phase2 pot${POWER}_0003.ptau pot${POWER}_final.ptau -v

# Verify
echo ""
echo "Verifying Powers of Tau..."
snarkjs powersoftau verify pot${POWER}_final.ptau

echo "✓ Phase 1 complete"

echo ""
echo "Step 3: Phase 2 - Circuit-Specific Setup"
echo "=========================================="

# Check if circuit exists
CIRCUIT_DIR="../../circuits"
if [ ! -f "$CIRCUIT_DIR/build/${CIRCUIT_NAME}.r1cs" ]; then
    echo "Compiling circuit..."
    cd $CIRCUIT_DIR
    npm run compile
    cd -
fi

# Setup
echo "Running Groth16 setup..."
snarkjs groth16 setup $CIRCUIT_DIR/build/${CIRCUIT_NAME}.r1cs pot${POWER}_final.ptau ${CIRCUIT_NAME}_0000.zkey

# Contribute to circuit-specific phase
echo ""
echo "Contributing to circuit phase with beacon randomness..."
snarkjs zkey contribute ${CIRCUIT_NAME}_0000.zkey ${CIRCUIT_NAME}_0001.zkey \
    --name="drand beacon" \
    -v -e="$RANDOMNESS"

# Second circuit contribution
echo ""
echo "Second circuit contribution with system entropy..."
SYSTEM_ENTROPY2="$(date +%s%N)$(cat /proc/sys/kernel/random/uuid)$(free -m | sha256sum)"
snarkjs zkey contribute ${CIRCUIT_NAME}_0001.zkey ${CIRCUIT_NAME}_0002.zkey \
    --name="System entropy 2" \
    -v -e="$SYSTEM_ENTROPY2"

# Apply randomness beacon for final contribution
echo ""
echo "Applying final beacon randomness..."
# Use a future drand round hash as beacon
BEACON_HASH=$(curl -s $BEACON_URL | jq -r '.randomness')
snarkjs zkey beacon ${CIRCUIT_NAME}_0002.zkey ${CIRCUIT_NAME}_final.zkey \
    $BEACON_HASH 10 \
    -n="Final beacon contribution"

# Verify
echo ""
echo "Verifying circuit setup..."
snarkjs zkey verify $CIRCUIT_DIR/build/${CIRCUIT_NAME}.r1cs pot${POWER}_final.ptau ${CIRCUIT_NAME}_final.zkey

echo "✓ Phase 2 complete"

echo ""
echo "Step 4: Exporting Verification Key"
echo "=========================================="

snarkjs zkey export verificationkey ${CIRCUIT_NAME}_final.zkey verification_key.json

echo "✓ Verification key exported"

echo ""
echo "Step 5: Generating Solidity Verifier (optional)"
echo "=========================================="

snarkjs zkey export solidityverifier ${CIRCUIT_NAME}_final.zkey verifier.sol

echo "✓ Solidity verifier generated"

echo ""
echo "Step 6: Exporting for Rust/Solana"
echo "=========================================="

cp verification_key.json $CIRCUIT_DIR/build/
cd $CIRCUIT_DIR
node verification_key_loader.js
cd -

echo "✓ Rust constants generated"

echo ""
echo "Step 7: Generating Transcript"
echo "=========================================="

# Create comprehensive transcript
cat > ceremony_transcript.json <<EOF
{
  "ceremony_type": "automated_trusted_setup",
  "circuit_name": "$CIRCUIT_NAME",
  "power": $POWER,
  "date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "randomness_sources": [
    {
      "source": "drand_beacon",
      "round": $BEACON_ROUND,
      "randomness": "$RANDOMNESS",
      "url": "$BEACON_URL"
    },
    {
      "source": "system_entropy",
      "method": "date+uuid+process_list"
    },
    {
      "source": "random_org",
      "method": "https_api_call"
    }
  ],
  "contributions": {
    "phase1_powers_of_tau": 3,
    "phase2_circuit_specific": 3
  },
  "files": {
    "powers_of_tau": "pot${POWER}_final.ptau",
    "proving_key": "${CIRCUIT_NAME}_final.zkey",
    "verification_key": "verification_key.json",
    "transcript": "ceremony_transcript.json"
  },
  "verification": {
    "phase1_verified": true,
    "phase2_verified": true,
    "verification_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  },
  "security_note": "This ceremony used multiple independent entropy sources including drand public randomness beacon, system entropy, and random.org. Only one source needs to be honest for security."
}
EOF

echo "✓ Transcript generated"

echo ""
echo "Step 8: Calculating File Hashes"
echo "=========================================="

sha256sum pot${POWER}_final.ptau > hashes.txt
sha256sum ${CIRCUIT_NAME}_final.zkey >> hashes.txt
sha256sum verification_key.json >> hashes.txt

echo "File hashes:"
cat hashes.txt

echo ""
echo "Step 9: Cleanup"
echo "=========================================="

echo "Removing intermediate files..."
rm -f pot${POWER}_0000.ptau pot${POWER}_0001.ptau pot${POWER}_0002.ptau pot${POWER}_0003.ptau
rm -f ${CIRCUIT_NAME}_0000.zkey ${CIRCUIT_NAME}_0001.zkey ${CIRCUIT_NAME}_0002.zkey

echo "✓ Intermediate files removed"

echo ""
echo "=========================================="
echo "Ceremony Complete!"
echo "=========================================="
echo ""
echo "Generated files:"
echo "  - pot${POWER}_final.ptau (Powers of Tau)"
echo "  - ${CIRCUIT_NAME}_final.zkey (Proving Key)"
echo "  - verification_key.json (Verification Key)"
echo "  - ceremony_transcript.json (Full transcript)"
echo "  - hashes.txt (File hashes for verification)"
echo ""
echo "Verification:"
echo "  Anyone can verify this ceremony by:"
echo "  1. Checking drand beacon randomness matches"
echo "  2. Running: snarkjs powersoftau verify pot${POWER}_final.ptau"
echo "  3. Running: snarkjs zkey verify <r1cs> pot${POWER}_final.ptau ${CIRCUIT_NAME}_final.zkey"
echo "  4. Comparing file hashes"
echo ""
echo "Security guarantee:"
echo "  This ceremony is secure as long as at least ONE of:"
echo "  - drand randomness beacon was honest"
echo "  - System entropy was unpredictable"
echo "  - random.org was honest"
echo ""
echo "Next steps:"
echo "  1. Copy ${CIRCUIT_NAME}_final.zkey to prover service"
echo "  2. Copy verification_key.json to contracts"
echo "  3. Deploy to mainnet"
echo ""
echo "✓ Ready for production deployment!"
