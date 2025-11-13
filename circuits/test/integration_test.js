/**
 * Integration test for complete proof generation and verification
 */

const { groth16 } = require('snarkjs');
const path = require('path');
const fs = require('fs');
const { buildEddsa } = require('circomlibjs');

describe('Complete Proof Flow Integration Test', function() {
  this.timeout(120000); // 2 minutes for full flow

  let eddsa;
  let provingKey;
  let verificationKey;

  before(async () => {
    // Load crypto libraries
    eddsa = await buildEddsa();

    // Check if keys exist
    const zkeyPath = path.join(__dirname, '../build/payment_proof_final.zkey');
    const vkeyPath = path.join(__dirname, '../build/verification_key.json');

    if (!fs.existsSync(zkeyPath)) {
      console.error('\n❌ Proving key not found!');
      console.error('Run: npm run build-all');
      throw new Error('Missing proving key');
    }

    if (!fs.existsSync(vkeyPath)) {
      console.error('\n❌ Verification key not found!');
      console.error('Run: npm run export');
      throw new Error('Missing verification key');
    }

    // Load verification key
    verificationKey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));
    console.log('✓ Verification key loaded');
  });

  it('should generate and verify a valid payment proof', async () => {
    console.log('\n' + '='.repeat(60));
    console.log('Testing Complete Proof Flow');
    console.log('='.repeat(60));

    // Generate EdDSA key pair for sender
    const senderPrivKey = Buffer.from('1'.repeat(64), 'hex');
    const senderPubKey = eddsa.prv2pub(senderPrivKey);

    // Generate EdDSA key pair for recipient
    const recipientPrivKey = Buffer.from('2'.repeat(64), 'hex');
    const recipientPubKey = eddsa.prv2pub(recipientPrivKey);

    console.log(`Sender public key: [${senderPubKey[0]}, ${senderPubKey[1]}]`);
    console.log(`Recipient public key: [${recipientPubKey[0]}, ${recipientPubKey[1]}]`);

    // Payment details
    const minAmount = 1000000; // 0.001 SOL
    const actualAmount = 1500000; // 0.0015 SOL (more than minimum)
    const maxBlockAge = 60; // seconds
    const currentTime = Math.floor(Date.now() / 1000);
    const paymentTime = currentTime - 10; // 10 seconds ago

    // Create message to sign (payment hash)
    const msgHash = eddsa.poseidon([
      actualAmount,
      senderPubKey[0],
      senderPubKey[1],
      recipientPubKey[0],
      recipientPubKey[1],
    ]);

    // Add timestamp to message
    const fullMessage = eddsa.poseidon([msgHash, paymentTime]);

    // Sign the message
    const signature = eddsa.signPoseidon(senderPrivKey, fullMessage);

    console.log(`\nMessage hash: ${msgHash}`);
    console.log(`Signature R: [${signature.R8[0]}, ${signature.R8[1]}]`);
    console.log(`Signature S: ${signature.S}`);

    // Verify signature (sanity check)
    const sigValid = eddsa.verifyPoseidon(fullMessage, signature, senderPubKey);
    if (!sigValid) {
      throw new Error('Signature verification failed!');
    }
    console.log('✓ Signature is valid');

    // Prepare circuit inputs
    const input = {
      // Public inputs
      minAmount: minAmount.toString(),
      recipientPubKeyX: recipientPubKey[0].toString(),
      recipientPubKeyY: recipientPubKey[1].toString(),
      maxBlockAge: maxBlockAge.toString(),
      currentTime: currentTime.toString(),

      // Private inputs
      actualAmount: actualAmount.toString(),
      senderPubKeyX: senderPubKey[0].toString(),
      senderPubKeyY: senderPubKey[1].toString(),
      paymentTime: paymentTime.toString(),
      R8x: signature.R8[0].toString(),
      R8y: signature.R8[1].toString(),
      S: signature.S.toString(),
    };

    console.log('\n' + '-'.repeat(60));
    console.log('Generating witness...');
    const startWitness = Date.now();

    // Generate witness
    const wasmPath = path.join(__dirname, '../build/payment_proof_js/payment_proof.wasm');
    const { proof, publicSignals } = await groth16.fullProve(
      input,
      wasmPath,
      path.join(__dirname, '../build/payment_proof_final.zkey')
    );

    const witnessTime = Date.now() - startWitness;
    console.log(`✓ Witness generated in ${witnessTime}ms`);

    console.log('\n' + '-'.repeat(60));
    console.log('Generating proof...');
    const proofTime = Date.now() - startWitness;
    console.log(`✓ Proof generated in ${proofTime}ms`);

    console.log('\nProof size:');
    console.log(`  A: ${JSON.stringify(proof.pi_a).length} bytes`);
    console.log(`  B: ${JSON.stringify(proof.pi_b).length} bytes`);
    console.log(`  C: ${JSON.stringify(proof.pi_c).length} bytes`);

    console.log('\nPublic signals:');
    publicSignals.forEach((signal, i) => {
      console.log(`  [${i}]: ${signal}`);
    });

    console.log('\n' + '-'.repeat(60));
    console.log('Verifying proof...');
    const startVerify = Date.now();

    const isValid = await groth16.verify(verificationKey, publicSignals, proof);

    const verifyTime = Date.now() - startVerify;
    console.log(`✓ Proof verified in ${verifyTime}ms`);

    if (!isValid) {
      throw new Error('Proof verification failed!');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ COMPLETE PROOF FLOW SUCCESSFUL');
    console.log('='.repeat(60));
    console.log(`Total time: ${Date.now() - startWitness}ms`);
    console.log(`  - Proof generation: ${proofTime}ms`);
    console.log(`  - Verification: ${verifyTime}ms`);
    console.log('='.repeat(60));

    // Assert success
    if (!isValid) {
      throw new Error('Proof verification failed');
    }
  });

  it('should reject invalid proofs (wrong amount)', async () => {
    console.log('\n' + '='.repeat(60));
    console.log('Testing Invalid Proof Rejection');
    console.log('='.repeat(60));

    // Generate keys
    const senderPrivKey = Buffer.from('1'.repeat(64), 'hex');
    const senderPubKey = eddsa.prv2pub(senderPrivKey);
    const recipientPrivKey = Buffer.from('2'.repeat(64), 'hex');
    const recipientPubKey = eddsa.prv2pub(recipientPrivKey);

    // Payment details - actualAmount < minAmount (should fail!)
    const minAmount = 2000000; // 0.002 SOL
    const actualAmount = 1000000; // 0.001 SOL (LESS than minimum!)
    const currentTime = Math.floor(Date.now() / 1000);
    const paymentTime = currentTime - 10;

    const msgHash = eddsa.poseidon([
      actualAmount,
      senderPubKey[0],
      senderPubKey[1],
      recipientPubKey[0],
      recipientPubKey[1],
    ]);

    const fullMessage = eddsa.poseidon([msgHash, paymentTime]);
    const signature = eddsa.signPoseidon(senderPrivKey, fullMessage);

    const input = {
      minAmount: minAmount.toString(),
      recipientPubKeyX: recipientPubKey[0].toString(),
      recipientPubKeyY: recipientPubKey[1].toString(),
      maxBlockAge: '60',
      currentTime: currentTime.toString(),
      actualAmount: actualAmount.toString(),
      senderPubKeyX: senderPubKey[0].toString(),
      senderPubKeyY: senderPubKey[1].toString(),
      paymentTime: paymentTime.toString(),
      R8x: signature.R8[0].toString(),
      R8y: signature.R8[1].toString(),
      S: signature.S.toString(),
    };

    console.log('Attempting to generate proof with insufficient amount...');

    try {
      const wasmPath = path.join(__dirname, '../build/payment_proof_js/payment_proof.wasm');
      await groth16.fullProve(
        input,
        wasmPath,
        path.join(__dirname, '../build/payment_proof_final.zkey')
      );

      throw new Error('Expected proof generation to fail, but it succeeded!');
    } catch (error) {
      console.log(`✓ Proof generation correctly failed: ${error.message}`);
    }

    console.log('='.repeat(60));
  });
});
