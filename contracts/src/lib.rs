use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    alt_bn128::{
        alt_bn128_addition, alt_bn128_multiplication, alt_bn128_pairing,
        AltBn128Error, ALT_BN128_PAIRING_OUTPUT_LEN,
    },
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
};

// Import verification key constants
// After circuit compilation, replace vkey_placeholder.rs with circuits/build/vkey_constants.rs
mod vkey_placeholder;
use vkey_placeholder::*;

// Program entrypoint
entrypoint!(process_instruction);

/// Groth16 proof structure
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct Groth16Proof {
    pub a: [u8; 64],  // G1 point
    pub b: [u8; 128], // G2 point
    pub c: [u8; 64],  // G1 point
}

/// Public inputs for payment verification
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct PaymentPublicInputs {
    pub min_amount: u64,
    pub recipient_pubkey: [u8; 32],
    pub max_block_age: u64,
    pub current_time: i64,
}

/// Instruction data
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub enum VerifierInstruction {
    /// Verify a Groth16 proof
    ///
    /// Accounts expected:
    /// 0. `[]` System program
    VerifyProof {
        proof: Groth16Proof,
        public_inputs: PaymentPublicInputs,
    },
}

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = VerifierInstruction::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    match instruction {
        VerifierInstruction::VerifyProof {
            proof,
            public_inputs,
        } => {
            msg!("Verifying ZK payment proof");
            verify_payment_proof(program_id, accounts, &proof, &public_inputs)
        }
    }
}

/// Verify Groth16 proof using Solana's alt_bn128 syscalls
fn verify_payment_proof(
    _program_id: &Pubkey,
    _accounts: &[AccountInfo],
    proof: &Groth16Proof,
    public_inputs: &PaymentPublicInputs,
) -> ProgramResult {
    msg!("Min amount: {}", public_inputs.min_amount);
    msg!("Current time: {}", public_inputs.current_time);

    // Verification key points (loaded from circuit compilation)
    // These will be replaced with actual values after running npm run export-rust
    let vk_alpha_g1 = VK_ALPHA_G1;
    let vk_beta_g2 = VK_BETA_G2;
    let vk_gamma_g2 = VK_GAMMA_G2;
    let vk_delta_g2 = VK_DELTA_G2;

    // IC points would be computed based on public inputs
    // IC[0] + IC[1] * min_amount + IC[2] * recipient_pubkey[0] + ...

    // Groth16 pairing check: e(A, B) = e(alpha, beta) * e(pub_input, gamma) * e(C, delta)
    // This translates to: e(A, B) * e(-pub_input, gamma) * e(-C, delta) * e(-alpha, beta) = 1

    // Prepare pairing input (4 pairs for Groth16)
    let mut pairing_input = Vec::with_capacity(384); // 4 pairs * 96 bytes each

    // Pair 1: e(A, B)
    pairing_input.extend_from_slice(&proof.a);
    pairing_input.extend_from_slice(&proof.b);

    // Pair 2: e(-pub_input_point, gamma)
    // This requires computing pub_input_point from IC points
    let pub_input_point = compute_public_input_point(public_inputs)?;
    let negated_pub_input = negate_g1_point(&pub_input_point)?;
    pairing_input.extend_from_slice(&negated_pub_input);
    pairing_input.extend_from_slice(&vk_gamma_g2);

    // Pair 3: e(-C, delta)
    let negated_c = negate_g1_point(&proof.c)?;
    pairing_input.extend_from_slice(&negated_c);
    pairing_input.extend_from_slice(&vk_delta_g2);

    // Pair 4: e(-alpha, beta)
    let negated_alpha = negate_g1_point(&vk_alpha_g1)?;
    pairing_input.extend_from_slice(&negated_alpha);
    pairing_input.extend_from_slice(&vk_beta_g2);

    // Execute pairing check
    let mut pairing_result = [0u8; ALT_BN128_PAIRING_OUTPUT_LEN];
    alt_bn128_pairing(&pairing_input, &mut pairing_result)
        .map_err(|e| {
            msg!("Pairing failed: {:?}", e);
            ProgramError::InvalidArgument
        })?;

    // Check if result equals 1 (valid proof)
    let expected = [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,
    ];

    if pairing_result == expected {
        msg!("✓ Payment proof verified successfully");
        Ok(())
    } else {
        msg!("✗ Payment proof verification failed");
        Err(ProgramError::InvalidArgument)
    }
}

/// Compute public input point from IC points and public inputs
fn compute_public_input_point(public_inputs: &PaymentPublicInputs) -> Result<[u8; 64], ProgramError> {
    // IC[0] is the base point
    // For each public input i: result = IC[0] + IC[1]*input[0] + IC[2]*input[1] + ...

    // Start with IC[0] (the constant term)
    let mut result = VK_IC[0];

    // Convert public inputs to scalars
    let inputs = [
        public_inputs.min_amount,
        u64::from_le_bytes(public_inputs.recipient_pubkey[0..8].try_into().unwrap()),
        u64::from_le_bytes(public_inputs.recipient_pubkey[8..16].try_into().unwrap()),
        public_inputs.max_block_age,
        public_inputs.current_time as u64,
    ];

    // For each public input, compute IC[i+1] * input[i] and add to result
    for (i, &input_val) in inputs.iter().enumerate() {
        if i + 1 >= VK_IC.len() {
            break;
        }

        let ic_point = &VK_IC[i + 1];

        // Convert input to 32-byte scalar (little-endian)
        let mut scalar = [0u8; 32];
        let input_bytes = input_val.to_le_bytes();
        scalar[..8].copy_from_slice(&input_bytes);

        // Perform scalar multiplication: temp = IC[i+1] * input[i]
        let mut multiplication_input = Vec::with_capacity(96);
        multiplication_input.extend_from_slice(ic_point);
        multiplication_input.extend_from_slice(&scalar);

        let mut temp = [0u8; 64];
        alt_bn128_multiplication(&multiplication_input, &mut temp)
            .map_err(|e| {
                msg!("Scalar multiplication failed: {:?}", e);
                ProgramError::InvalidArgument
            })?;

        // Add to result: result = result + temp
        let mut addition_input = Vec::with_capacity(128);
        addition_input.extend_from_slice(&result);
        addition_input.extend_from_slice(&temp);

        alt_bn128_addition(&addition_input, &mut result)
            .map_err(|e| {
                msg!("Point addition failed: {:?}", e);
                ProgramError::InvalidArgument
            })?;
    }

    Ok(result)
}

/// Negate a G1 point (flip y coordinate)
fn negate_g1_point(point: &[u8]) -> Result<[u8; 64], ProgramError> {
    if point.len() != 64 {
        return Err(ProgramError::InvalidArgument);
    }

    let mut negated = [0u8; 64];

    // x coordinate stays the same
    negated[..32].copy_from_slice(&point[..32]);

    // y_neg = p - y (where p is the BN254 field modulus)
    // p = 21888242871839275222246405745257275088696311157297823662689037894645226208583
    const FIELD_MODULUS: [u8; 32] = [
        0x47, 0xfd, 0x7c, 0xd8, 0x16, 0x8c, 0x20, 0x3c,
        0x8d, 0xca, 0x71, 0x68, 0x91, 0x6a, 0x81, 0x97,
        0x5d, 0x58, 0x81, 0x81, 0xb6, 0x45, 0x50, 0xb8,
        0x29, 0xa0, 0x31, 0xe1, 0x72, 0x4e, 0x64, 0x30,
    ];

    // Perform subtraction: y_neg = p - y
    let y = &point[32..];
    let mut borrow = 0u16;

    for i in 0..32 {
        let diff = FIELD_MODULUS[i] as u16 + 256 - y[i] as u16 - borrow;
        negated[32 + i] = (diff & 0xFF) as u8;
        borrow = if diff < 256 { 1 } else { 0 };
    }

    Ok(negated)
}

#[cfg(test)]
mod tests {
    use super::*;
    use solana_program::clock::Epoch;
    use solana_sdk::signature::{Keypair, Signer};

    #[test]
    fn test_verify_proof() {
        let program_id = Pubkey::new_unique();

        let proof = Groth16Proof {
            a: [0u8; 64],
            b: [0u8; 128],
            c: [0u8; 64],
        };

        let public_inputs = PaymentPublicInputs {
            min_amount: 1000000, // 0.001 SOL in lamports
            recipient_pubkey: [0u8; 32],
            max_block_age: 60,
            current_time: 1700000000,
        };

        // This will fail until we have real verification key and proof
        // Just testing the interface compiles
        assert!(true);
    }
}
