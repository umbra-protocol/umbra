#[cfg(test)]
mod tests {
    use solana_program_test::*;
    use solana_sdk::{
        signature::{Keypair, Signer},
        transaction::Transaction,
        instruction::{AccountMeta, Instruction},
    };
    use borsh::BorshSerialize;
    use x402_zk_verifier::*;

    #[tokio::test]
    async fn test_proof_verification() {
        // Create program test environment
        let program_id = Pubkey::new_unique();
        let mut program_test = ProgramTest::new(
            "x402_zk_verifier",
            program_id,
            processor!(process_instruction),
        );

        // Start test environment
        let (mut banks_client, payer, recent_blockhash) = program_test.start().await;

        // Create mock proof (in real test, use actual proof from circuit)
        let proof = Groth16Proof {
            a: [1u8; 64],
            b: [2u8; 128],
            c: [3u8; 64],
        };

        let public_inputs = PaymentPublicInputs {
            min_amount: 1000000,
            recipient_pubkey: [4u8; 32],
            max_block_age: 60,
            current_time: 1700000000,
        };

        let instruction_data = VerifierInstruction::VerifyProof {
            proof,
            public_inputs,
        };

        // Create instruction
        let instruction = Instruction::new_with_borsh(
            program_id,
            &instruction_data,
            vec![],
        );

        // Create and send transaction
        let mut transaction = Transaction::new_with_payer(
            &[instruction],
            Some(&payer.pubkey()),
        );

        transaction.sign(&[&payer], recent_blockhash);

        // Note: This will fail with mock proof data
        // Real test requires actual proof from circuit
        let result = banks_client.process_transaction(transaction).await;

        // With mock data, we expect failure
        assert!(result.is_err(), "Mock proof should fail verification");
    }

    #[test]
    fn test_negate_g1_point() {
        use x402_zk_verifier::negate_g1_point;

        // Test point negation
        let point = [1u8; 64];
        let negated = negate_g1_point(&point).unwrap();

        // x coordinate should stay same
        assert_eq!(&negated[..32], &point[..32]);

        // y coordinate should be different (negated)
        assert_ne!(&negated[32..], &point[32..]);
    }

    #[test]
    fn test_public_input_serialization() {
        let public_inputs = PaymentPublicInputs {
            min_amount: 1000000,
            recipient_pubkey: [42u8; 32],
            max_block_age: 60,
            current_time: 1700000000,
        };

        // Test borsh serialization
        let serialized = public_inputs.try_to_vec().unwrap();
        let deserialized = PaymentPublicInputs::try_from_slice(&serialized).unwrap();

        assert_eq!(deserialized.min_amount, public_inputs.min_amount);
        assert_eq!(deserialized.max_block_age, public_inputs.max_block_age);
        assert_eq!(deserialized.current_time, public_inputs.current_time);
    }
}
