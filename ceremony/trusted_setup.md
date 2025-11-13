# Multi-Party Trusted Setup Ceremony

## Overview

For mainnet deployment, we need a **multi-party trusted setup ceremony** where multiple independent parties contribute randomness. Only ONE party needs to be honest for the system to be secure.

## Ceremony Coordinator Guide

### Prerequisites

- Secure server for coordination
- Communication channel (Discord/Telegram)
- At least 10 contributors (more is better)
- Estimated time: 3-5 days

### Phase 1: Powers of Tau (Universal Setup)

This creates the universal trusted setup for BN254 curve at power 12.

```bash
# Coordinator starts the ceremony
cd circuits
snarkjs powersoftau new bn128 12 pot12_0000.ptau -v

# Upload pot12_0000.ptau to secure location
# Share download link with Contributor 1
```

### Phase 2: Contributor Participation

Each contributor (sequentially):

1. Downloads latest `.ptau` file
2. Contributes randomness
3. Uploads result
4. Posts hash publicly

```bash
# Contributor N
snarkjs powersoftau contribute pot12_N-1.ptau pot12_N.ptau \
  --name="Contributor N" \
  -v -e="$(head -c 32 /dev/urandom | base64)"

# Calculate and publish hash
snarkjs powersoftau verify pot12_N.ptau
# Post the hash publicly (Twitter/GitHub)
```

### Phase 3: Final Preparation

After all contributions:

```bash
# Coordinator: Prepare phase2
snarkjs powersoftau prepare phase2 pot12_N.ptau pot12_final.ptau -v

# Verify all contributions
snarkjs powersoftau verify pot12_final.ptau

# Publish transcript
snarkjs powersoftau export json pot12_final.ptau pot12_transcript.json
```

### Phase 4: Circuit-Specific Setup

```bash
# Generate proving key
cd circuits
npm run compile
snarkjs groth16 setup build/payment_proof.r1cs ../ceremony/pot12_final.ptau build/payment_proof_0000.zkey

# Second round of contributions (circuit-specific)
snarkjs zkey contribute build/payment_proof_0000.zkey build/payment_proof_0001.zkey \
  --name="Circuit Contributor 1" -v

# Multiple contributors
# ... (repeat for each contributor)

# Final verification
snarkjs zkey verify build/payment_proof.r1cs ../ceremony/pot12_final.ptau build/payment_proof_final.zkey

# Export verification key
snarkjs zkey export verificationkey build/payment_proof_final.zkey build/verification_key.json

# Export beacon (for transparency)
snarkjs zkey beacon build/payment_proof_final.zkey build/payment_proof_beacon.zkey \
  0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon"
```

### Phase 5: Publish Artifacts

Upload to public, immutable storage:

- `pot12_final.ptau` (universal setup)
- `pot12_transcript.json` (all contributions)
- `payment_proof_final.zkey` (proving key)
- `verification_key.json` (verification key)
- All contribution hashes
- Verification instructions

## Contributor Instructions

### Your Role

You are helping to generate cryptographic randomness. The security of the entire system depends on at least ONE contributor being honest.

### Requirements

- Computer with 8GB+ RAM
- 1 hour of time
- Node.js installed
- snarkjs installed: `npm install -g snarkjs`

### Step-by-Step

1. **Download Latest File**
   ```bash
   # Coordinator will provide link
   wget https://ceremony.example.com/pot12_N.ptau
   ```

2. **Verify Previous Contributions**
   ```bash
   snarkjs powersoftau verify pot12_N.ptau
   # Check the hash matches what previous contributor posted
   ```

3. **Generate Your Entropy**

   Create randomness using multiple sources:
   ```bash
   # Option 1: Random text
   ENTROPY="$(date +%s%N) $(who) $(ps aux) $(cat /proc/meminfo) my secret phrase"

   # Option 2: Hardware RNG
   ENTROPY="$(head -c 64 /dev/random | base64)"

   # Option 3: Manual (most secure)
   # Type random characters for 30 seconds
   read -s ENTROPY
   ```

4. **Contribute**
   ```bash
   snarkjs powersoftau contribute pot12_N.ptau pot12_N+1.ptau \
     --name="Your Name/Handle" \
     -v -e="$ENTROPY"
   ```

5. **Calculate and Publish Hash**
   ```bash
   # Get the hash
   snarkjs powersoftau verify pot12_N+1.ptau

   # Copy the hash and post publicly on:
   # - Twitter
   # - GitHub issue
   # - Discord
   ```

6. **Upload Result**
   ```bash
   # Upload pot12_N+1.ptau to coordinator
   # Delete your local copy
   rm pot12_N.ptau pot12_N+1.ptau
   ```

7. **Destroy Entropy**
   ```bash
   # Clear your terminal history
   history -c

   # Restart your computer (optional but recommended)
   sudo reboot
   ```

### Security Best Practices

- Use a **fresh OS installation** (VM or live USB)
- **Disconnect from internet** during entropy generation
- Use **multiple entropy sources** combined
- **Destroy all traces** after contributing
- Never reuse entropy
- Consider using **different hardware** than you normally use

### What NOT To Do

- ❌ Don't use predictable entropy (like "abc123")
- ❌ Don't skip verification steps
- ❌ Don't share your entropy with anyone
- ❌ Don't contribute multiple times with same entropy
- ❌ Don't keep copies of intermediate files

## Verification Guide (For Anyone)

Anyone can verify the ceremony was done correctly:

```bash
# Download all artifacts
wget https://ceremony.example.com/pot12_final.ptau
wget https://ceremony.example.com/pot12_transcript.json

# Verify the ceremony
snarkjs powersoftau verify pot12_final.ptau

# Check all contribution hashes match what was published
cat pot12_transcript.json | grep hash

# Verify circuit-specific setup
wget https://ceremony.example.com/payment_proof_final.zkey
wget https://ceremony.example.com/payment_proof.r1cs

snarkjs zkey verify payment_proof.r1cs pot12_final.ptau payment_proof_final.zkey
```

## Security Guarantees

### Threat Model

**Attack**: Someone wants to create fake proofs

**Defense**: Ceremony with N contributors

**Result**: Attacker must compromise ALL N contributors

**With 10 contributors**: Attacker needs to:
- Compromise 10 different people
- On 10 different systems
- At 10 different times
- Without anyone noticing

**Probability of success**: Effectively zero if even ONE contributor is honest

### Trust Assumptions

You must trust that:
- ✅ At least ONE contributor was honest
- ✅ At least ONE contributor destroyed their entropy
- ✅ The coordinator didn't tamper with files

You do NOT need to trust:
- ❌ The coordinator is honest (verifiable)
- ❌ Most contributors are honest (only need 1)
- ❌ Contributors used strong entropy (only need 1 good one)

## Timeline

### Typical Ceremony Schedule

**Day 1**: Announcement and contributor signup
**Days 2-4**: Powers of Tau contributions (1-2 hours per contributor)
**Day 5**: Coordinator prepares phase 2
**Days 6-8**: Circuit-specific contributions
**Day 9**: Final verification and publication
**Day 10**: Public verification period

## Emergency Procedures

### If Ceremony is Compromised

1. **Stop immediately**
2. **Announce the issue publicly**
3. **Identify what went wrong**
4. **Start new ceremony from scratch**
5. **Add additional safeguards**

### Signs of Compromise

- Contributor can't reproduce their hash
- Files modified between contributions
- Verification fails
- Coordinator acting suspiciously
- Same entropy used twice

## After Ceremony

### Update Codebase

```bash
# Copy final artifacts
cp ceremony/pot12_final.ptau circuits/
cp circuits/build/verification_key.json sdk/
cp circuits/build/payment_proof_final.zkey prover/

# Regenerate Rust constants
cd circuits
npm run export-rust
cp build/vkey_constants.rs ../contracts/src/

# Rebuild everything
cd ..
npm run build
```

### Destroy Secrets

```bash
# Delete all intermediate .ptau files
rm ceremony/pot12_*.ptau
# Keep only pot12_final.ptau

# Delete intermediate .zkey files
rm circuits/build/payment_proof_*.zkey
# Keep only payment_proof_final.zkey
```

### Publish Transparency Report

Create `CEREMONY_REPORT.md`:

```markdown
# Trusted Setup Ceremony Report

**Date**: [Date]
**Circuit**: x402 Payment Proof
**Power**: 12 (supports up to 4096 constraints)
**Curve**: BN254

## Contributors

1. [Name] - [Hash] - [Twitter link]
2. [Name] - [Hash] - [GitHub link]
...
10. [Name] - [Hash] - [Twitter link]

## Artifacts

- Universal setup: [IPFS hash]
- Circuit setup: [IPFS hash]
- Verification key: [IPFS hash]
- Transcript: [IPFS hash]

## Verification

All contributions verified: ✅
Public verification period: [Date] - [Date]
Independent verifications: [Number]

## Attestations

[Name]: "I contributed entropy on [date] and destroyed all traces"
[Name]: "I verified the ceremony and all hashes match"
```

## Mainnet Deployment Checklist

After successful ceremony:

- [ ] All contributors confirmed participation
- [ ] All hashes posted publicly
- [ ] Independent verification completed
- [ ] Artifacts uploaded to IPFS/Arweave
- [ ] Transparency report published
- [ ] Verification instructions published
- [ ] 7-day public review period completed
- [ ] No issues found
- [ ] Codebase updated with final keys
- [ ] Security audit scheduled

Only after ALL checkboxes: Deploy to mainnet

## Resources

- **SnarkJS Docs**: https://github.com/iden3/snarkjs
- **Perpetual Powers of Tau**: https://github.com/weijiekoh/perpetualpowersoftau
- **Trusted Setup Ceremony**: https://blog.ethereum.org/2023/01/16/announcing-kzg-ceremony
- **ZK Security**: https://www.zksecurity.xyz/

## Support

Questions about the ceremony?
- Discord: [Link]
- GitHub Discussions: [Link]
- Email: security@yourproject.com
