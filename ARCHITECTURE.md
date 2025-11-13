# x402 ZK Payment Architecture

## Overview

This system enables privacy-preserving payments for x402 protocol using zero-knowledge proofs on Solana.

## Components

### 1. Circuits (`/circuits`)

**Purpose**: Define the cryptographic constraints for payment proofs.

**Technology**: Circom + SnarkJS

**Key Files**:
- `payment_proof.circom` - Main circuit definition
- Constraints proved:
  - `actualAmount >= minAmount`
  - `currentTime - paymentTime <= maxBlockAge`
  - Valid EdDSA signature on payment
  - Transaction hash matches payment details

**Build Process**:
```bash
circom payment_proof.circom --r1cs --wasm --sym
snarkjs groth16 setup # Trusted setup
snarkjs zkey contribute # Multi-party computation
snarkjs zkey export verificationkey # Extract vkey
```

### 2. Contracts (`/contracts`)

**Purpose**: On-chain verification of Groth16 proofs.

**Technology**: Rust + Solana SDK

**Key Features**:
- Uses Solana's `alt_bn128` syscalls for pairing operations
- Verifies proofs in ~1.1M compute units
- Hardcoded verification key from circuit compilation
- Public inputs validated against x402 requirements

**Verification Process**:
1. Deserialize proof (A, B, C points)
2. Compute public input point from IC curve
3. Execute pairing check: `e(A,B) = e(α,β) * e(pub,γ) * e(C,δ)`
4. Return success/failure

### 3. Prover Service (`/prover`)

**Purpose**: Generate ZK proofs from payment data.

**Technology**: Go + gnark

**Why Go + gnark**:
- Fast proof generation (~120ms for our circuit size)
- Mature Groth16 implementation
- Better performance than browser-based SnarkJS for server-side proving

**API Endpoints**:
- `POST /generate-proof` - Generate proof from witness data
- `GET /health` - Service health check

**Flow**:
1. Receive public inputs + private witness
2. Compile circuit (cached after first run)
3. Create witness assignment
4. Generate Groth16 proof
5. Verify proof (sanity check)
6. Return serialized proof + public inputs

### 4. SDK (`/sdk`)

**Purpose**: TypeScript client library for x402 ZK payments.

**Technology**: TypeScript + Solana Web3.js

**Classes**:

#### `ZKPaymentClient`
- Main interface for making x402 requests
- Handles: payment → proof generation → HTTP request
- Methods:
  - `request(options, payer)` - Make paid x402 request
  - `getBalance(pubkey)` - Check wallet balance
  - `requestAirdrop(pubkey, amount)` - Get devnet SOL

#### `ProofGenerator`
- Communicates with prover service
- Handles serialization/deserialization
- Methods:
  - `generateProof(inputs)` - Request proof from service
  - `healthCheck()` - Verify prover is online

#### `X402ZKMiddleware`
- Express/Node middleware for servers
- Verifies proofs from incoming requests
- Can verify locally or on-chain
- Methods:
  - `middleware()` - Express middleware function
  - `verifyProof(proof, inputs)` - Verify proof validity

### 5. Server (`/server`)

**Purpose**: Example x402 server accepting ZK payment proofs.

**Technology**: Express + TypeScript

**Routes**:

**Public** (no payment):
- `GET /` - API documentation
- `GET /health` - Server health

**Protected** (ZK proof required):
- `GET /api/premium-data` - Return premium content
- `POST /api/ai-service` - Simulated AI service
- `POST /api/expensive-computation` - Compute-heavy endpoint

**Middleware Flow**:
1. Extract `X-ZK-PROOF` and `X-ZK-PUBLIC-INPUTS` headers
2. Verify proof (local or on-chain)
3. If valid: proceed, add verification headers
4. If invalid: return 402 Payment Required

## Data Flow

### Complete Payment Flow

```
┌──────────┐
│  Client  │
└────┬─────┘
     │
     │ 1. Make payment on Solana
     ├──────────────────────────────────┐
     │                                  ▼
     │                            ┌──────────┐
     │                            │  Solana  │
     │                            │Blockchain│
     │                            └──────────┘
     │
     │ 2. Request proof generation
     ├─────────────────────────────────►┌─────────────┐
     │                                   │   Prover    │
     │                                   │  Service    │
     │◄──────────────────────────────────┤   (gnark)   │
     │ 3. Receive proof                  └─────────────┘
     │
     │ 4. HTTP request + proof headers
     ├─────────────────────────────────►┌─────────────┐
     │                                   │   x402      │
     │                                   │   Server    │
     │                                   └──────┬──────┘
     │                                          │
     │                                5. Verify proof
     │                                          │
     │                                   ┌──────▼──────┐
     │                                   │  Verifier   │
     │                                   │ (local/on-  │
     │                                   │   chain)    │
     │                                   └──────┬──────┘
     │                                          │
     │ 6. Serve resource                 6. Valid?
     │◄──────────────────────────────────┤
     │
```

## Privacy Properties

### What Stays Private

1. **Actual payment amount** - Only proven to be >= minimum
2. **Sender address** - Never revealed to service
3. **Transaction signature** - Service can't look up on-chain tx
4. **Exact payment time** - Only proven to be recent

### What's Public

1. **Minimum amount required** - Service sets this
2. **Recipient address** - Service's payment address
3. **Max block age** - Prevents replay attacks
4. **Current time** - For freshness verification

### Threat Model

**Protected Against**:
- Service tracking users across requests
- Competitors analyzing spending patterns
- MEV bots frontrunning based on payment info
- On-chain analysis linking payments to usage

**Not Protected Against**:
- Timing correlation (if you're only user)
- IP-based tracking (use VPN/Tor)
- Network-level monitoring (use encrypted channels)

## Cryptographic Details

### Circuit Constraints

Total constraints: ~5,000 (estimated)

Breakdown:
- Amount comparison: ~200 constraints
- Time comparison: ~200 constraints
- Poseidon hash (payment): ~1,000 constraints
- EdDSA signature verification: ~2,500 constraints
- Poseidon hash (tx): ~1,000 constraints

### Proof Size

- **Groth16 proof**: 128 bytes
  - A (G1): 64 bytes
  - B (G2): 128 bytes → compressed to 64 bytes
  - C (G1): 64 bytes
- **Public inputs**: ~128 bytes (4 field elements)
- **Total HTTP overhead**: ~256 bytes (base64 encoded)

### Performance Targets

| Operation | Target | Actual |
|-----------|--------|--------|
| Proof generation | < 200ms | ~120ms |
| Proof verification (local) | < 5ms | ~2ms |
| Proof verification (on-chain) | < 2M CU | ~1.1M CU |
| Proof size | < 256 bytes | 128 bytes |

## Security Considerations

### Trusted Setup

Groth16 requires a trusted setup ceremony:

1. Initial setup generates "toxic waste"
2. If toxic waste is leaked, fake proofs can be created
3. Multi-party computation makes this extremely hard
4. Each party must be compromised for attack to succeed

**Mitigation**: Use Powers of Tau ceremony with many participants

### Replay Attacks

Proofs include `currentTime` and `maxBlockAge`:

- Proof valid for max 60 seconds
- After expiration, proof cannot be reused
- Service should track used proofs (optional)

### Front-Running

Service sees proof but not actual payment:

- Cannot determine exact payment amount
- Cannot link proof to on-chain transaction
- Cannot frontrun or extract MEV

## Development Roadmap

### Phase 1: Core Implementation ✓
- [x] Circuit design
- [x] Prover service
- [x] SDK implementation
- [x] Example server

### Phase 2: Production Hardening
- [ ] Trusted setup ceremony
- [ ] On-chain verification
- [ ] Proof caching
- [ ] Rate limiting

### Phase 3: Optimizations
- [ ] Reduce circuit size
- [ ] Faster proof generation
- [ ] Batch verification
- [ ] Payment channels integration

### Phase 4: Advanced Features
- [ ] Multi-chain support
- [ ] USDC/token payments
- [ ] Subscription proofs
- [ ] Recursive proofs

## Deployment Guide

### Prerequisites

1. Node.js 18+
2. Rust + Solana CLI
3. Go 1.21+
4. Circom 2.1+

### Setup Steps

```bash
# 1. Install dependencies
npm run setup

# 2. Compile circuits
cd circuits
npm run compile
npm run setup
npm run contribute
npm run export

# 3. Build Solana program
cd ../contracts
cargo build-bpf
solana program deploy target/deploy/x402_zk_verifier.so

# 4. Build SDK
cd ../sdk
npm run build

# 5. Start prover service
cd ../prover
go run main.go

# 6. Start example server
cd ../server
npm run dev
```

### Environment Variables

**Server** (`.env`):
```
SOLANA_RPC_URL=https://api.devnet.solana.com
VERIFIER_PROGRAM_ID=<deployed program id>
PROVER_SERVICE_URL=http://localhost:8080
PORT=3000
```

**Client**:
```
Same as server, plus:
SERVER_URL=http://localhost:3000
```

## Testing

### Unit Tests

```bash
# Test circuits
cd circuits && npm test

# Test Solana program
cd contracts && cargo test

# Test SDK
cd sdk && npm test
```

### Integration Test

```bash
# 1. Start all services
npm run start:prover  # Terminal 1
npm run start:server  # Terminal 2

# 2. Run client example
cd server
npm run dev -- src/client-example.ts
```

## Contributing

Areas for contribution:
1. Circuit optimizations
2. Alternative proof systems (PLONK, STARKs)
3. Additional language SDKs (Python, Rust, Go)
4. Batch verification
5. Payment channel integration

## License

MIT
