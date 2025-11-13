# Quick Start Guide

Get up and running with x402 ZK payments in 10 minutes.

## What You'll Build

A privacy-preserving payment system where:
- AI agents pay for API access on Solana
- Payment amounts remain private
- Sender identities stay anonymous
- Services get verified payment without seeing details

## Prerequisites

```bash
# Check you have:
node --version  # v18+
go version      # 1.21+
rustc --version # 1.70+
solana --version # 1.17+
```

## Installation

### 1. Clone and Setup

```bash
cd "C:\Users\gsent\Desktop\solana projects\x402-zk-payments"
npm install
```

### 2. Install Circom (for circuits)

**Windows**:
```bash
# Download circom from GitHub releases
# https://github.com/iden3/circom/releases
# Add to PATH
```

**Mac/Linux**:
```bash
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
git clone https://github.com/iden3/circom.git
cd circom
cargo build --release
cargo install --path circom
```

### 3. Install Dependencies

```bash
# Circuits
cd circuits
npm install

# SDK
cd ../sdk
npm install

# Server
cd ../server
npm install

# Prover (Go modules)
cd ../prover
go mod download
```

## Running the System

### Terminal 1: Start Prover Service

```bash
cd prover
go run main.go
```

You should see:
```
Starting x402 ZK Prover Service...
Compiling circuit...
Circuit constraints: 5234
✓ Proving key generated
✓ Verification key generated
Prover service ready on :8080
```

### Terminal 2: Start x402 Server

```bash
cd server
cp .env.example .env
npm run dev
```

You should see:
```
============================================================
x402 ZK Payment Server
============================================================
Server running on http://localhost:3000
Solana RPC: https://api.devnet.solana.com
============================================================
```

### Terminal 3: Run Client Example

```bash
cd server
npx ts-node src/client-example.ts
```

## Understanding the Flow

### 1. Client Makes Payment

```typescript
const client = new ZKPaymentClient({
  proverServiceUrl: 'http://localhost:8080',
  solanaRpcUrl: 'https://api.devnet.solana.com',
  verifierProgramId: VERIFIER_PROGRAM_ID,
});

// Make payment + generate proof + send request
const response = await client.request({
  url: 'http://localhost:3000/api/premium-data',
  paymentAmount: 0.001 * LAMPORTS_PER_SOL,
  paymentRecipient: serviceProvider,
}, payerKeypair);
```

### 2. What Happens Behind the Scenes

```
Client                 Solana              Prover              Server
  |                      |                   |                    |
  |--[Pay 0.001 SOL]---->|                   |                    |
  |                      |                   |                    |
  |-----[Generate proof with payment data]-->|                    |
  |<----[ZK proof (128 bytes)]---------------|                    |
  |                      |                   |                    |
  |--[HTTP GET + proof headers]----------------------------->     |
  |                      |                   |        [Verify proof]
  |<---[200 OK + premium data]------------------------------|     |
```

### 3. Privacy Guarantee

The server sees:
- ✓ Payment was >= minimum amount
- ✓ Payment went to correct address
- ✓ Payment is recent (< 60 seconds old)

The server NEVER sees:
- ✗ Actual payment amount
- ✗ Sender's wallet address
- ✗ Transaction signature
- ✗ Exact timestamp

## Code Examples

### Making a Request (Client)

```typescript
import { ZKPaymentClient } from '@x402/zk-payments-sdk';
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Initialize client
const client = new ZKPaymentClient({
  proverServiceUrl: 'http://localhost:8080',
  solanaRpcUrl: 'https://api.devnet.solana.com',
  verifierProgramId: new PublicKey('YOUR_PROGRAM_ID'),
});

// Make paid request
const response = await client.request({
  url: 'http://localhost:3000/api/ai-service',
  method: 'POST',
  paymentAmount: 0.002 * LAMPORTS_PER_SOL,
  paymentRecipient: new PublicKey('SERVICE_PROVIDER_ADDRESS'),
  body: { prompt: 'Hello, AI!' },
}, payerKeypair);

console.log(response.data); // AI response
console.log(`Proof verified: ${response.proofVerified}`);
```

### Accepting Payments (Server)

```typescript
import express from 'express';
import { X402ZKMiddleware } from '@x402/zk-payments-sdk';
import { PublicKey } from '@solana/web3.js';

const app = express();

// Initialize ZK middleware
const zkMiddleware = new X402ZKMiddleware(
  'https://api.devnet.solana.com',
  new PublicKey('YOUR_VERIFIER_PROGRAM')
);

// Protected route - requires payment
app.get('/api/premium-data',
  zkMiddleware.middleware(),  // Verify ZK proof
  (req, res) => {
    res.json({
      data: 'Premium content',
      message: 'Payment verified privately'
    });
  }
);

app.listen(3000);
```

## Testing

### Test Free Endpoint

```bash
curl http://localhost:3000/
```

Should return API documentation.

### Test Paid Endpoint (will fail without proof)

```bash
curl http://localhost:3000/api/premium-data
```

Should return:
```json
{
  "error": "Payment Required",
  "message": "Missing ZK proof headers"
}
```

### Test with Client Example

```bash
cd server
npx ts-node src/client-example.ts
```

Should show successful payment flow with ZK proofs.

## Common Issues

### "Prover service unreachable"

- Check prover is running on port 8080
- Check firewall settings

### "Airdrop failed"

- Devnet rate limits airdrop requests
- Use a faucet: https://faucet.solana.com
- Or use an existing funded wallet

### "Circuit compilation failed"

- Ensure circom is installed: `circom --version`
- Check circomlib is in node_modules
- Try `cd circuits && npm install`

### "Proof verification failed"

- Check clocks are synced (proof has 60s TTL)
- Ensure prover and verifier use same circuit
- Check verifier program is deployed

## Next Steps

1. **Deploy to devnet**: Compile and deploy Solana program
2. **Add more endpoints**: Protect API routes with ZK verification
3. **Customize circuit**: Modify constraints for your use case
4. **Optimize performance**: Tune circuit size and proving time
5. **Production setup**: Run trusted setup ceremony

## Resources

- **Full Architecture**: See `ARCHITECTURE.md`
- **API Documentation**: See `README.md`
- **Circuit Details**: See `circuits/README.md`
- **x402 Protocol**: https://github.com/coinbase/x402
- **Circom Docs**: https://docs.circom.io
- **gnark Docs**: https://docs.gnark.consensys.net

## Support

Having issues? Check:
1. All services are running
2. Environment variables are set
3. Dependencies are installed
4. Ports are not in use (8080, 3000)

## What's Next?

Now that you have the basics running:

- **For AI developers**: Integrate into your agent's payment logic
- **For service providers**: Add ZK verification to your APIs
- **For researchers**: Experiment with circuit optimizations
- **For hackathon participants**: Build on top of this infrastructure!

Privacy-preserving payments are the future of the agent economy. Welcome aboard!
