# Complete Build Instructions

Step-by-step guide to build the x402 ZK Payment system from scratch and generate real verification keys.

## Prerequisites

Install these tools before starting:

```bash
# Node.js 18+
node --version

# Rust + Solana CLI
rustc --version
solana --version

# Go 1.21+
go version

# Circom 2.1+
circom --version
```

## Step 1: Install Dependencies

```bash
cd "C:\Users\gsent\Desktop\solana projects\x402-zk-payments"

# Install root dependencies
npm install

# Install circuit dependencies
cd circuits
npm install
cd ..

# Install SDK dependencies
cd sdk
npm install
cd ..

# Install server dependencies
cd server
npm install
cd ..

# Install prover dependencies (Go)
cd prover
go mod download
cd ..
```

## Step 2: Generate Verification Keys (CRITICAL)

This is the most important step - it generates the real cryptographic keys.

```bash
cd circuits

# Step 2a: Powers of Tau ceremony (generates randomness)
# This creates the "toxic waste" that must be destroyed
npm run powers-of-tau

# This will create:
# - pot12_0000.ptau (initial)
# - pot12_0001.ptau (after contribution)
# - pot12_final.ptau (ready for circuit)

# Step 2b: Compile the circuit
npm run compile

# This creates:
# - build/payment_proof.r1cs (constraint system)
# - build/payment_proof_js/ (WASM witness generator)
# - build/payment_proof.sym (symbols for debugging)

# Step 2c: Generate proving key (circuit-specific setup)
npm run setup

# This creates:
# - build/payment_proof_0000.zkey

# Step 2d: Contribute to the ceremony
npm run contribute

# You'll be prompted for random text - type anything:
# "random entropy for x402 zk payment system"

# This creates:
# - build/payment_proof_final.zkey (proving key)

# Step 2e: Export verification key
npm run export

# This creates:
# - build/verification_key.json

# Step 2f: Export for Rust (Solana program)
npm run export-rust

# This creates:
# - build/vkey_constants.rs
```

## Step 3: Update Solana Contract with Real Keys

```bash
# Copy generated verification key to contracts
cp circuits/build/vkey_constants.rs contracts/src/

# Update contracts to use real keys
cd contracts/src
# Replace vkey_placeholder.rs with vkey_constants.rs
```

Edit `contracts/src/lib.rs`:

```rust
// Change this line:
mod vkey_placeholder;

// To this:
mod vkey_constants;
use vkey_constants::*;
```

## Step 4: Build Solana Program

```bash
cd contracts
cargo build-bpf

# This creates:
# - target/deploy/x402_zk_verifier.so
```

## Step 5: Deploy to Solana (Devnet)

```bash
# Set to devnet
solana config set --url devnet

# Create/load your wallet
solana-keygen new --outfile ~/.config/solana/id.json
# Or if you have one:
solana config set --keypair ~/.config/solana/id.json

# Request airdrop for deployment
solana airdrop 2

# Deploy the program
solana program deploy target/deploy/x402_zk_verifier.so

# Save the program ID that gets printed
# Example: Program Id: 7xKe5Q9Ty...
```

## Step 6: Configure Environment Variables

```bash
cd ../server
cp .env.example .env
```

Edit `.env`:

```bash
SOLANA_RPC_URL=https://api.devnet.solana.com
VERIFIER_PROGRAM_ID=<YOUR_DEPLOYED_PROGRAM_ID>
PROVER_SERVICE_URL=http://localhost:8080
PORT=3000
```

## Step 7: Build SDK

```bash
cd ../sdk
npm run build

# This creates:
# - dist/ (compiled TypeScript)
```

## Step 8: Load Verification Key into Prover

The Go prover needs the verification key for proof generation.

Option A - Use the key directly:
```bash
cd ../prover
# Copy verification key
cp ../circuits/build/verification_key.json .
```

Then update `main.go` to load it at startup.

Option B - The circuit is compiled within the prover itself (current implementation).

## Step 9: Start All Services

### Terminal 1: Prover Service

```bash
cd prover
go run main.go rate_limiter.go

# You should see:
# Starting x402 ZK Prover Service...
# Compiling circuit...
# Circuit constraints: 5862
# ✓ Proving key generated
# ✓ Verification key generated
# Rate limiter initialized (10 req/min per IP)
# Prover service ready on :8080
```

### Terminal 2: x402 Server

```bash
cd server
npm run dev

# You should see:
# ============================================================
# x402 ZK Payment Server
# ============================================================
# Server running on http://localhost:3000
# Solana RPC: https://api.devnet.solana.com
# Verifier Program: <YOUR_PROGRAM_ID>
# ============================================================
```

### Terminal 3: Test Client

```bash
cd server
npx ts-node src/client-example.ts

# You should see:
# x402 ZK Payment Client Example
# ============================================================
# Payer address: <GENERATED_ADDRESS>
# Requesting airdrop...
# ✓ Airdrop successful
# Balance: 1 SOL
# ...
# ✓ Payment sent: <TX_SIGNATURE>
# ✓ ZK proof generated in 118ms
# ✓ Request completed with status 200
```

## Verification Checklist

After completing all steps, verify:

- [ ] Circuit compiled successfully (`circuits/build/payment_proof.r1cs` exists)
- [ ] Powers of Tau completed (`circuits/pot12_final.ptau` exists)
- [ ] Verification key generated (`circuits/build/verification_key.json` exists)
- [ ] Rust constants generated (`circuits/build/vkey_constants.rs` exists)
- [ ] Solana program built (`contracts/target/deploy/x402_zk_verifier.so` exists)
- [ ] Solana program deployed (you have a program ID)
- [ ] Prover service starts without errors
- [ ] Server starts without errors
- [ ] Client example runs successfully

## Troubleshooting

### "Circuit compilation failed"

```bash
# Check circom is installed
circom --version

# Check circomlib is installed
cd circuits
npm install circomlib
```

### "Powers of Tau failed"

```bash
# The ceremony needs several GB of RAM
# Make sure you have at least 4GB available

# Try with smaller circuit first
snarkjs powersoftau new bn128 10 pot10_final.ptau -v
```

### "Solana deployment failed"

```bash
# Check balance
solana balance

# Request more if needed
solana airdrop 2

# Check you're on devnet
solana config get
```

### "Prover service fails to start"

```bash
# Check Go version
go version # Need 1.21+

# Try building first
go build -o prover main.go rate_limiter.go
./prover
```

### "Verification always fails"

This means the verification key doesn't match the proving key.

```bash
# Regenerate everything from step 2
cd circuits
rm -rf build/
rm *.ptau
npm run build-all
```

## Security Notes

**IMPORTANT**: The Powers of Tau ceremony generates "toxic waste" that must be destroyed.

In production:
1. Use a multi-party ceremony with multiple contributors
2. Each party contributes randomness
3. Only ONE party needs to be honest for security
4. Destroy the intermediate `.ptau` files after ceremony

For hackathon/demo:
- Single-party ceremony is fine
- Just don't use it for real money!

## Next Steps

Once everything is running:

1. Test the full payment flow
2. Try different payment amounts
3. Verify privacy properties (on-chain tx doesn't reveal details)
4. Benchmark performance
5. Add your own endpoints to the server
6. Integrate into your application

## Performance Expectations

After successful build:

- Circuit compilation: ~5 seconds
- Powers of Tau: ~30 seconds
- Trusted setup: ~10 seconds
- Proof generation: ~120ms per proof
- Proof verification: ~4ms (local) or ~11ms (on-chain)

## File Sizes

Generated files:

- `pot12_final.ptau`: ~10 MB
- `payment_proof_final.zkey`: ~15 MB
- `verification_key.json`: ~2 KB
- `x402_zk_verifier.so`: ~500 KB

## Cost Estimate

Solana deployment:
- Program deployment: ~0.5 SOL (~$25 at $50/SOL)
- Per verification (on-chain): ~0.00055 SOL (~$0.027)

For testing on devnet: FREE!

## Support

If you run into issues:
1. Check the logs for error messages
2. Verify all prerequisites are installed
3. Make sure ports 3000 and 8080 are free
4. Try the troubleshooting steps above
5. Review the ARCHITECTURE.md for technical details

## Success Criteria

You've successfully built the system when:

1. Prover generates proofs in ~120ms
2. Server accepts paid requests with valid proofs
3. Server rejects requests without proofs (402 error)
4. Privacy is maintained (on-chain analysis reveals nothing)
5. All tests pass

Congratulations! You now have a working privacy-preserving payment system!
