// Placeholder verification key constants
// Run `cd ../circuits && npm run export-rust` to generate real values
// Then replace this file with circuits/build/vkey_constants.rs

// THESE ARE PLACEHOLDER VALUES - NOT SECURE!
// The circuit must be compiled and a trusted setup performed first

pub const VK_ALPHA_G1: [u8; 64] = [0u8; 64];
pub const VK_BETA_G2: [u8; 128] = [0u8; 128];
pub const VK_GAMMA_G2: [u8; 128] = [0u8; 128];
pub const VK_DELTA_G2: [u8; 128] = [0u8; 128];

// IC points for public inputs
// Number of IC points = number of public inputs + 1
// Our circuit has 5 public inputs: minAmount, recipientPubKeyX, recipientPubKeyY, maxBlockAge, currentTime
// So we need 6 IC points (IC[0] through IC[5])
pub const VK_IC: [[u8; 64]; 6] = [[0u8; 64]; 6];
