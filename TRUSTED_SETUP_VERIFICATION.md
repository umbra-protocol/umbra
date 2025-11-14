# Trusted Setup Ceremony Verification Guide

**⚠️ CRITICAL: The trusted setup ceremony MUST be completed before production deployment.**

The trusted setup generates the proving and verification keys used in the zero-knowledge proof system. A compromised setup could allow fake proofs to be generated.

---

## Why Trusted Setup Matters

### Security Implications

A properly executed trusted setup ensures:
- ✅ Proofs cannot be forged without valid private inputs
- ✅ Verification keys are derived from verifiable randomness
- ✅ No party has access to the "toxic waste" (setup secret)

A compromised setup could:
- ❌ Allow attackers to generate valid-looking fake proofs
- ❌ Break the zero-knowledge property
- ❌ Undermine the entire security model

---

## Automated Ceremony (Recommended)

### Prerequisites

```bash
# Required tools
node >= 18.0.0
circom >= 2.1.0
snarkjs >= 0.7.0
curl (for drand beacon)
```

### Step 1: Run Automated Ceremony

```bash
cd ceremony
chmod +x automated_setup.sh
./automated_setup.sh
```

This script will:
1. Download circuit files
2. Fetch randomness from drand beacon
3. Generate proving key (pk.zkey)
4. Generate verification key (vk.json)
5. Export Solana verification key
6. Generate attestation document

### Step 2: Verify Outputs

The ceremony produces:

```
ceremony/
├── pk.zkey              # Proving key (DO NOT commit to git)
├── vk.json              # Verification key
├── verification_key.rs  # Solana contract verification key
├── attestation.json     # Setup attestation with hashes
└── ceremony.log         # Full ceremony log
```

**Check File Sizes**:
```bash
ls -lh ceremony/pk.zkey    # Should be ~15-50 MB
ls -lh ceremony/vk.json    # Should be ~2-5 KB
```

### Step 3: Verify Randomness Source

The ceremony uses **drand** (Distributed Randomness Beacon):

```bash
# View attestation
cat ceremony/attestation.json

# Verify drand beacon
curl https://drand.cloudflare.com/public/latest

# Compare randomness hash in attestation.json
```

**Expected attestation.json format**:
```json
{
  "ceremony_type": "automated_groth16",
  "timestamp": "2025-11-14T12:00:00Z",
  "circuit": "payment_proof.circom",
  "randomness_source": "drand",
  "randomness_round": 3456789,
  "randomness_hash": "abc123...",
  "pk_hash": "def456...",
  "vk_hash": "ghi789...",
  "verification_key_solana_hash": "jkl012...",
  "participants": ["drand_beacon", "automated_script"],
  "verification_url": "https://drand.cloudflare.com/public/3456789"
}
```

### Step 4: Publish Attestation

**For transparency**, publish your attestation:

1. **Option A - GitHub Release**:
   ```bash
   gh release create v1.0.0-ceremony ceremony/attestation.json
   ```

2. **Option B - IPFS**:
   ```bash
   ipfs add ceremony/attestation.json
   # Returns: QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```

3. **Option C - Public Registry**:
   Post to zkproof.org or similar registry

### Step 5: Deploy Verification Key

Update Solana contract with new verification key:

```bash
# Copy generated verification key
cp ceremony/verification_key.rs contracts/src/vkey.rs

# Rebuild contract
cd contracts
cargo build-bpf

# Deploy
solana program deploy target/deploy/umbra_verifier.so
```

---

## Manual Ceremony (Advanced)

For higher security, run a multi-party ceremony.

### Phase 1: Initialization

```bash
snarkjs groth16 setup circuits/payment_proof.r1cs ptau/pot12_final.ptau pk_0.zkey
```

### Phase 2: Contribution (Party 1)

```bash
snarkjs zkey contribute pk_0.zkey pk_1.zkey \
  --name="Participant 1" \
  --entropy="$(openssl rand -hex 32)"
```

### Phase 3: Contribution (Party 2)

```bash
snarkjs zkey contribute pk_1.zkey pk_2.zkey \
  --name="Participant 2" \
  --entropy="$(openssl rand -hex 32)"
```

### Phase 4: Contribution (Party 3+)

Repeat with additional participants...

```bash
snarkjs zkey contribute pk_N.zkey pk_final.zkey \
  --name="Participant N" \
  --entropy="$(openssl rand -hex 32)"
```

### Phase 5: Beacon

Apply randomness beacon:

```bash
snarkjs zkey beacon pk_final.zkey pk.zkey \
  $(curl -s https://drand.cloudflare.com/public/latest | jq -r .randomness) \
  10
```

### Phase 6: Export Keys

```bash
# Export verification key
snarkjs zkey export verificationkey pk.zkey vk.json

# Export Solana format
node scripts/export_solana_vkey.js vk.json > verification_key.rs
```

### Phase 7: Verify

Each participant should verify their contribution:

```bash
snarkjs zkey verify circuits/payment_proof.r1cs ptau/pot12_final.ptau pk.zkey
```

---

## Verification Checklist

### Pre-Deployment Verification

- [ ] Ceremony completed successfully (no errors in log)
- [ ] Proving key exists and is correct size
- [ ] Verification key generated
- [ ] Solana verification key exported
- [ ] Attestation document created
- [ ] Randomness source verified (drand beacon)
- [ ] File hashes match attestation
- [ ] Attestation published publicly
- [ ] All ceremony artifacts backed up securely

### Key Security

- [ ] Proving key (pk.zkey) stored securely
- [ ] Proving key NOT committed to public git
- [ ] Access to proving key restricted (only prover service)
- [ ] Verification key deployed to Solana contract
- [ ] Backup of all keys stored offline

### Verification Testing

- [ ] Generate test proof with new keys
- [ ] Verify test proof on-chain
- [ ] Confirm proof verification succeeds
- [ ] Test invalid proof rejection
- [ ] Run full test suite with new keys

---

## Security Best Practices

### Multi-Party Ceremony

For production deployments, use a multi-party ceremony:

**Advantages**:
- Requires only ONE honest participant to be secure
- Increases trust through decentralization
- Provides stronger security guarantees

**Participants**:
- Internal team members (3-5 people)
- External auditors
- Community members
- Automated beacon (drand)

**Minimum Participants**: 3 (more is better)

### Entropy Sources

Use high-quality randomness:

```bash
# Good sources
/dev/random              # System entropy
openssl rand -hex 32     # OpenSSL random
drand beacon             # Distributed randomness
hardware RNG             # Hardware security module

# Bad sources
Date/time stamps         # Predictable
Sequential numbers       # Not random
User-provided strings    # Low entropy
```

### Key Management

**Proving Key (pk.zkey)**:
- Store in secure key management system
- Restrict access (only prover service needs it)
- Encrypt at rest
- Regular backups
- Access logging
- DO NOT commit to public repository

**Verification Key (vk.json)**:
- Can be public
- Embed in Solana contract
- Include in attestation
- Publish for verification

---

## Powers of Tau (ptau)

The ceremony requires a Powers of Tau file.

### Download Pre-Generated

```bash
cd ceremony
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau
mv powersOfTau28_hez_final_12.ptau pot12_final.ptau
```

### Verify Hash

```bash
sha256sum pot12_final.ptau

# Expected: 55c77ce8562366c91e7cda394cf7b7c15a06c12d8c905e8b36ba9cf5e13eb37d
```

### Generate Your Own (Advanced)

For maximum security, generate your own:

```bash
snarkjs powersoftau new bn128 12 pot12_0000.ptau
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First contribution"
# ... repeat with multiple participants
snarkjs powersoftau prepare phase2 pot12_final.ptau pot12_final.ptau
```

**Warning**: This takes significant time and computational resources.

---

## Verification of Ceremony

### Verify Your Ceremony

```bash
cd ceremony

# Verify circuit compilation
snarkjs info -r payment_proof.r1cs

# Verify proving key
snarkjs zkey verify payment_proof.r1cs pot12_final.ptau pk.zkey

# Verify verification key matches
snarkjs zkey export verificationkey pk.zkey vk_check.json
diff vk.json vk_check.json  # Should be identical
```

### Independent Verification

Anyone can verify your ceremony:

```bash
# Download your attestation.json
curl -O https://github.com/umbra-protocol/umbra/releases/download/v1.0.0/attestation.json

# Verify hashes
sha256sum ceremony/pk.zkey  # Should match attestation.json
sha256sum ceremony/vk.json  # Should match attestation.json

# Verify randomness
curl https://drand.cloudflare.com/public/$(jq -r .randomness_round attestation.json)
# Compare .randomness field with attestation.json
```

---

## Troubleshooting

### Error: "ptau file not found"

```bash
cd ceremony
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau
```

### Error: "snarkjs not found"

```bash
npm install -g snarkjs@latest
```

### Error: "Circuit compilation failed"

```bash
cd circuits
npm install
circom payment_proof.circom --r1cs --wasm --sym
```

### Error: "Verification failed"

This is serious. Possible causes:
- Corrupted files during ceremony
- Incorrect circuit version
- Mismatched ptau file

**Solution**: Re-run entire ceremony from scratch.

### Memory Issues

Ceremony requires 4-8 GB RAM. If encountering memory errors:

```bash
export NODE_OPTIONS="--max-old-space-size=8192"
./automated_setup.sh
```

---

## Post-Ceremony Actions

### 1. Update Documentation

Document your ceremony:
- Date and participants
- Randomness source and verification
- Published attestation location
- Verification instructions

### 2. Update Contracts

Deploy new verification key:

```bash
cd contracts
cp ../ceremony/verification_key.rs src/vkey.rs
cargo build-bpf
solana program deploy target/deploy/umbra_verifier.so
```

### 3. Update Prover Service

Copy proving key to prover:

```bash
# Secure copy
scp ceremony/pk.zkey prover-server:/opt/umbra/keys/
ssh prover-server 'chmod 400 /opt/umbra/keys/pk.zkey'
```

### 4. Test End-to-End

```bash
cd testing
npm test  # Should all pass with new keys
```

### 5. Announce Ceremony Completion

Notify community:
- GitHub release notes
- Twitter/social media
- Documentation update
- Transparency report

---

## Ceremony Transparency

### Publish Publicly

For maximum trust:

1. **GitHub Release**:
   - Attestation document
   - Verification key
   - Ceremony log (redact any secrets)

2. **Public Registry**:
   - zkproof.org
   - Archive.org
   - IPFS

3. **Blog Post**:
   - Ceremony procedure
   - Participants
   - Verification instructions

4. **Community Verification**:
   - Encourage independent verification
   - Publish verification scripts
   - Respond to questions transparently

---

## Questions?

**Ceremony Issues**: ceremony@umbra-protocol.io
**Security Concerns**: security@umbra-protocol.io
**General Questions**: hello@umbra-protocol.io

---

## Additional Resources

- [snarkjs Documentation](https://github.com/iden3/snarkjs)
- [Powers of Tau Ceremony](https://github.com/weijiekoh/perpetualpowersoftau)
- [drand Randomness Beacon](https://drand.love/)
- [Groth16 Paper](https://eprint.iacr.org/2016/260.pdf)
- [ZK Proof Standards](https://zkproof.org/)

---

*Last Updated: November 2025*
*Version: 1.0*
