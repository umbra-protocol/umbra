pragma circom 2.1.0;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/eddsaposeidon.circom";
include "circomlib/circuits/bitify.circom";

/*
 * Payment Proof Circuit
 *
 * Proves that a valid Solana payment was made without revealing:
 * - Actual payment amount (only that it meets minimum)
 * - Sender address
 * - Transaction signature
 * - Exact timestamp
 */
template PaymentProof() {
    // Public inputs (known to verifier)
    signal input minAmount;           // Minimum payment required
    signal input recipientPubKeyX;    // Service's public key X (EdDSA)
    signal input recipientPubKeyY;    // Service's public key Y (EdDSA)
    signal input maxBlockAge;         // Maximum seconds since payment
    signal input currentTime;         // Current block timestamp

    // Private inputs (kept secret)
    signal input actualAmount;        // Actual amount paid
    signal input senderPubKeyX;       // Payer's public key X
    signal input senderPubKeyY;       // Payer's public key Y
    signal input paymentTime;         // When payment was made
    signal input R8x;                 // Signature R point X
    signal input R8y;                 // Signature R point Y
    signal input S;                   // Signature S scalar

    // Output - proof is valid
    signal output valid;

    // 1. Verify amount is sufficient
    component amountCheck = GreaterEqThan(64);
    amountCheck.in[0] <== actualAmount;
    amountCheck.in[1] <== minAmount;
    amountCheck.out === 1;

    // 2. Verify payment is recent enough
    signal timeDiff;
    timeDiff <== currentTime - paymentTime;

    component timeCheck = LessThan(64);
    timeCheck.in[0] <== timeDiff;
    timeCheck.in[1] <== maxBlockAge;
    timeCheck.out === 1;

    // 3. Hash payment details to create message
    component paymentHasher = Poseidon(5);
    paymentHasher.inputs[0] <== actualAmount;
    paymentHasher.inputs[1] <== senderPubKeyX;
    paymentHasher.inputs[2] <== senderPubKeyY;
    paymentHasher.inputs[3] <== recipientPubKeyX;
    paymentHasher.inputs[4] <== recipientPubKeyY;

    // 4. Add timestamp to message
    component messageHasher = Poseidon(2);
    messageHasher.inputs[0] <== paymentHasher.out;
    messageHasher.inputs[1] <== paymentTime;

    // 5. Verify EdDSA signature on payment message
    component sigVerifier = EdDSAPoseidonVerifier();
    sigVerifier.enabled <== 1;
    sigVerifier.Ax <== senderPubKeyX;
    sigVerifier.Ay <== senderPubKeyY;
    sigVerifier.R8x <== R8x;
    sigVerifier.R8y <== R8y;
    sigVerifier.S <== S;
    sigVerifier.M <== messageHasher.out;

    // 6. Verify signature is valid (sigVerifier doesn't have output, uses assert)
    // If signature is invalid, circuit will fail to compute witness

    // All checks passed
    valid <== 1;
}

component main {public [minAmount, recipientPubKeyX, recipientPubKeyY, maxBlockAge, currentTime]} = PaymentProof();
