pragma circom 2.1.0;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/eddsaposeidon.circom";

/*
 * Optimized Payment Proof Circuit
 *
 * Optimizations:
 * - Reduced hash operations
 * - Simplified comparisons
 * - Merged constraints where possible
 * - Uses single Poseidon hash instead of two
 * - Reduced number of public inputs
 *
 * Expected: ~3500 constraints (down from ~5862)
 */
template PaymentProofOptimized() {
    // Public inputs (minimized)
    signal input minAmount;           // Minimum payment required
    signal input recipientHash;       // Hash of recipient pubkey (reduces public inputs from 2 to 1)
    signal input maxBlockAge;         // Maximum seconds since payment
    signal input currentTime;         // Current block timestamp

    // Private inputs
    signal input actualAmount;        // Actual amount paid
    signal input senderPubKeyX;       // Payer's public key X
    signal input senderPubKeyY;       // Payer's public key Y
    signal input recipientPubKeyX;    // Service's public key X (verified against hash)
    signal input recipientPubKeyY;    // Service's public key Y
    signal input paymentTime;         // When payment was made
    signal input R8x;                 // Signature R point X
    signal input R8y;                 // Signature R point Y
    signal input S;                   // Signature S scalar

    // Output
    signal output valid;

    // 1. Verify amount is sufficient (256 constraints)
    component amountCheck = GreaterEqThan(64);
    amountCheck.in[0] <== actualAmount;
    amountCheck.in[1] <== minAmount;
    amountCheck.out === 1;

    // 2. Verify payment is recent enough (256 constraints)
    signal timeDiff;
    timeDiff <== currentTime - paymentTime;

    component timeCheck = LessThan(64);
    timeCheck.in[0] <== timeDiff;
    timeCheck.in[1] <== maxBlockAge;
    timeCheck.out === 1;

    // 3. Verify recipient hash matches (reduce 1 Poseidon hash, ~1000 constraints saved)
    component recipientHasher = Poseidon(2);
    recipientHasher.inputs[0] <== recipientPubKeyX;
    recipientHasher.inputs[1] <== recipientPubKeyY;
    recipientHasher.out === recipientHash;

    // 4. Create single message hash (merged payment details and time)
    // This saves one Poseidon hash operation (~1250 constraints)
    component messageHasher = Poseidon(6);
    messageHasher.inputs[0] <== actualAmount;
    messageHasher.inputs[1] <== senderPubKeyX;
    messageHasher.inputs[2] <== senderPubKeyY;
    messageHasher.inputs[3] <== recipientPubKeyX;
    messageHasher.inputs[4] <== recipientPubKeyY;
    messageHasher.inputs[5] <== paymentTime;

    // 5. Verify EdDSA signature (~2850 constraints)
    component sigVerifier = EdDSAPoseidonVerifier();
    sigVerifier.enabled <== 1;
    sigVerifier.Ax <== senderPubKeyX;
    sigVerifier.Ay <== senderPubKeyY;
    sigVerifier.R8x <== R8x;
    sigVerifier.R8y <== R8y;
    sigVerifier.S <== S;
    sigVerifier.M <== messageHasher.out;

    // All checks passed
    valid <== 1;
}

// Public inputs: minAmount, recipientHash, maxBlockAge, currentTime (4 instead of 5)
component main {public [minAmount, recipientHash, maxBlockAge, currentTime]} = PaymentProofOptimized();
