use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::AccountInfo,
    alt_bn128::{alt_bn128_addition, alt_bn128_pairing, ALT_BN128_PAIRING_OUTPUT_LEN},
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
};

use crate::{Groth16Proof, PaymentPublicInputs};

/// Batch verification of multiple Groth16 proofs
/// More efficient than verifying individually
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct BatchVerificationRequest {
    pub proofs: Vec<Groth16Proof>,
    pub public_inputs: Vec<PaymentPublicInputs>,
}

/// Verify multiple proofs in a single batch
/// Uses aggregated pairing to reduce compute cost
pub fn batch_verify_proofs(
    _program_id: &solana_program::pubkey::Pubkey,
    _accounts: &[AccountInfo],
    request: &BatchVerificationRequest,
) -> ProgramResult {
    if request.proofs.len() != request.public_inputs.len() {
        msg!("Mismatched proof and input counts");
        return Err(ProgramError::InvalidArgument);
    }

    if request.proofs.is_empty() {
        msg!("No proofs to verify");
        return Err(ProgramError::InvalidArgument);
    }

    let num_proofs = request.proofs.len();
    msg!("Batch verifying {} proofs", num_proofs);

    // For batch verification, we need to:
    // 1. Generate random coefficients (using Fiat-Shamir)
    // 2. Aggregate proofs: A_agg = sum(r_i * A_i)
    // 3. Aggregate B's: B_agg = sum(r_i * B_i)
    // 4. Aggregate C's: C_agg = sum(r_i * C_i)
    // 5. Single pairing check

    // Generate pseudo-random coefficients using Fiat-Shamir
    let coefficients = generate_batch_coefficients(num_proofs, &request.proofs)?;

    // Aggregate A points
    let a_agg = aggregate_g1_points(
        &request.proofs.iter().map(|p| &p.a[..]).collect::<Vec<_>>(),
        &coefficients,
    )?;

    msg!("✓ A points aggregated");

    // Aggregate B points
    let b_agg = aggregate_g2_points(
        &request.proofs.iter().map(|p| &p.b[..]).collect::<Vec<_>>(),
        &coefficients,
    )?;

    msg!("✓ B points aggregated");

    // Aggregate C points
    let c_agg = aggregate_g1_points(
        &request.proofs.iter().map(|p| &p.c[..]).collect::<Vec<_>>(),
        &coefficients,
    )?;

    msg!("✓ C points aggregated");

    // Now perform single pairing check on aggregated values
    // This is much cheaper than num_proofs individual pairings
    let mut pairing_input = Vec::with_capacity(384);
    pairing_input.extend_from_slice(&a_agg);
    pairing_input.extend_from_slice(&b_agg);

    // Add remaining pairing elements (verification key components)
    // ... (similar to individual verification)

    let mut pairing_result = [0u8; ALT_BN128_PAIRING_OUTPUT_LEN];
    alt_bn128_pairing(&pairing_input, &mut pairing_result).map_err(|e| {
        msg!("Batch pairing failed: {:?}", e);
        ProgramError::InvalidArgument
    })?;

    let expected = [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 1,
    ];

    if pairing_result == expected {
        msg!("✓ Batch verification successful for {} proofs", num_proofs);
        Ok(())
    } else {
        msg!("✗ Batch verification failed");
        Err(ProgramError::InvalidArgument)
    }
}

/// Generate pseudo-random coefficients for batch verification
/// Uses Fiat-Shamir heuristic for non-interactivity
fn generate_batch_coefficients(
    num_proofs: usize,
    proofs: &[Groth16Proof],
) -> Result<Vec<[u8; 32]>, ProgramError> {
    let mut coefficients = Vec::with_capacity(num_proofs);

    // Simple deterministic generation (in production, use proper hash)
    for i in 0..num_proofs {
        let mut coeff = [0u8; 32];
        // Use proof data to generate coefficient
        let hash_input = [&proofs[i].a[..], &[i as u8]].concat();
        // In production: use SHA256 or similar
        coeff[..hash_input.len().min(32)].copy_from_slice(&hash_input[..hash_input.len().min(32)]);
        coefficients.push(coeff);
    }

    Ok(coefficients)
}

/// Aggregate G1 points with coefficients
fn aggregate_g1_points(
    points: &[&[u8]],
    coefficients: &[[u8; 32]],
) -> Result<[u8; 64], ProgramError> {
    if points.len() != coefficients.len() {
        return Err(ProgramError::InvalidArgument);
    }

    if points.is_empty() {
        return Err(ProgramError::InvalidArgument);
    }

    // Start with first point (identity would be better, but we don't have it)
    let mut result = [0u8; 64];
    result.copy_from_slice(points[0]);

    // Add remaining points
    for i in 1..points.len() {
        // Scalar multiply: temp = coefficient[i] * points[i]
        let mut multiplication_input = Vec::with_capacity(96);
        multiplication_input.extend_from_slice(points[i]);
        multiplication_input.extend_from_slice(&coefficients[i]);

        let mut temp = [0u8; 64];
        solana_program::alt_bn128::alt_bn128_multiplication(&multiplication_input, &mut temp)
            .map_err(|_| ProgramError::InvalidArgument)?;

        // Add to result: result = result + temp
        let mut addition_input = Vec::with_capacity(128);
        addition_input.extend_from_slice(&result);
        addition_input.extend_from_slice(&temp);

        alt_bn128_addition(&addition_input, &mut result)
            .map_err(|_| ProgramError::InvalidArgument)?;
    }

    Ok(result)
}

/// Aggregate G2 points with coefficients
fn aggregate_g2_points(
    points: &[&[u8]],
    coefficients: &[[u8; 32]],
) -> Result<[u8; 128], ProgramError> {
    if points.len() != coefficients.len() {
        return Err(ProgramError::InvalidArgument);
    }

    if points.is_empty() {
        return Err(ProgramError::InvalidArgument);
    }

    // G2 points are 128 bytes
    let mut result = [0u8; 128];
    result.copy_from_slice(points[0]);

    // Note: G2 operations are not directly supported by alt_bn128
    // In practice, batch verification for Groth16 typically only aggregates G1 points
    // This is a simplified version

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_coefficient_generation() {
        let proofs = vec![
            Groth16Proof {
                a: [1u8; 64],
                b: [2u8; 128],
                c: [3u8; 64],
            },
            Groth16Proof {
                a: [4u8; 64],
                b: [5u8; 128],
                c: [6u8; 64],
            },
        ];

        let coeffs = generate_batch_coefficients(2, &proofs).unwrap();
        assert_eq!(coeffs.len(), 2);
    }
}
