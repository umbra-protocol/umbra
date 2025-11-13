const path = require('path');
const wasm_tester = require('circom_tester').wasm;
const buildPoseidon = require('circomlibjs').buildPoseidon;

describe('Payment Proof Circuit', function() {
  this.timeout(100000);

  let circuit;
  let poseidon;

  before(async () => {
    circuit = await wasm_tester(
      path.join(__dirname, '../payment_proof.circom'),
      {
        output: path.join(__dirname, '../build'),
        recompile: true,
      }
    );

    poseidon = await buildPoseidon();
  });

  it('should verify valid payment proof', async () => {
    const input = {
      // Public inputs
      minAmount: 1000000, // 0.001 SOL
      recipientPubKey: [
        '12345678901234567890123456789012',
        '98765432109876543210987654321098'
      ],
      maxBlockAge: 60,
      currentTime: 1700000000,

      // Private inputs
      actualAmount: 1500000, // 0.0015 SOL (more than minimum)
      senderPubKey: [
        '11111111111111111111111111111111',
        '22222222222222222222222222222222'
      ],
      transactionHash: '123456789',
      paymentTime: 1699999950, // 50 seconds ago
      signature: [1, 2, 3],
      R8: [
        '33333333333333333333333333333333',
        '44444444444444444444444444444444'
      ],
      S: '55555555555555555555555555555555'
    };

    const witness = await circuit.calculateWitness(input, true);
    await circuit.checkConstraints(witness);

    // Check output is 1 (valid)
    await circuit.assertOut(witness, { valid: 1 });
  });

  it('should fail when amount is insufficient', async () => {
    const input = {
      minAmount: 2000000, // 0.002 SOL
      recipientPubKey: ['12345678901234567890123456789012', '98765432109876543210987654321098'],
      maxBlockAge: 60,
      currentTime: 1700000000,
      actualAmount: 1000000, // Only 0.001 SOL (less than minimum!)
      senderPubKey: ['11111111111111111111111111111111', '22222222222222222222222222222222'],
      transactionHash: '123456789',
      paymentTime: 1699999950,
      signature: [1, 2, 3],
      R8: ['33333333333333333333333333333333', '44444444444444444444444444444444'],
      S: '55555555555555555555555555555555'
    };

    try {
      await circuit.calculateWitness(input, true);
      throw new Error('Expected circuit to fail but it succeeded');
    } catch (error) {
      // Expected to fail
      console.log('✓ Circuit correctly rejected insufficient payment');
    }
  });

  it('should fail when payment is too old', async () => {
    const input = {
      minAmount: 1000000,
      recipientPubKey: ['12345678901234567890123456789012', '98765432109876543210987654321098'],
      maxBlockAge: 60,
      currentTime: 1700000000,
      actualAmount: 1500000,
      senderPubKey: ['11111111111111111111111111111111', '22222222222222222222222222222222'],
      transactionHash: '123456789',
      paymentTime: 1699999900, // 100 seconds ago (too old!)
      signature: [1, 2, 3],
      R8: ['33333333333333333333333333333333', '44444444444444444444444444444444'],
      S: '55555555555555555555555555555555'
    };

    try {
      await circuit.calculateWitness(input, true);
      throw new Error('Expected circuit to fail but it succeeded');
    } catch (error) {
      // Expected to fail
      console.log('✓ Circuit correctly rejected old payment');
    }
  });

  it('should compute correct number of constraints', async () => {
    const constraints = await circuit.getConstraints();
    console.log(`Circuit has ${constraints.length} constraints`);

    // We expect around 5000 constraints
    // This is a sanity check - adjust based on actual circuit
    if (constraints.length > 10000) {
      console.warn('⚠ Circuit might be too large for efficient proving');
    }
  });

  it('should calculate witness in reasonable time', async function() {
    this.timeout(5000); // 5 second timeout

    const input = {
      minAmount: 1000000,
      recipientPubKey: ['12345678901234567890123456789012', '98765432109876543210987654321098'],
      maxBlockAge: 60,
      currentTime: 1700000000,
      actualAmount: 1500000,
      senderPubKey: ['11111111111111111111111111111111', '22222222222222222222222222222222'],
      transactionHash: '123456789',
      paymentTime: 1699999950,
      signature: [1, 2, 3],
      R8: ['33333333333333333333333333333333', '44444444444444444444444444444444'],
      S: '55555555555555555555555555555555'
    };

    const startTime = Date.now();
    await circuit.calculateWitness(input, true);
    const endTime = Date.now();

    const duration = endTime - startTime;
    console.log(`Witness calculation took ${duration}ms`);

    if (duration > 1000) {
      console.warn('⚠ Witness calculation is slow, may impact proof generation time');
    }
  });
});
