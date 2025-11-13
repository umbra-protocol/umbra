/**
 * Load and export verification key for use in Solana program
 * Run this after circuit compilation and setup
 */

const fs = require('fs');
const path = require('path');

async function loadVerificationKey() {
  const vkeyPath = path.join(__dirname, 'build', 'verification_key.json');

  if (!fs.existsSync(vkeyPath)) {
    console.error('Verification key not found!');
    console.error('Run these commands first:');
    console.error('  npm run compile');
    console.error('  npm run setup');
    console.error('  npm run export');
    process.exit(1);
  }

  const vkey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));

  console.log('Verification Key Loaded:');
  console.log('='.repeat(60));

  // Extract key components
  const alpha_g1 = vkey.vk_alpha_1;
  const beta_g2 = vkey.vk_beta_2;
  const gamma_g2 = vkey.vk_gamma_2;
  const delta_g2 = vkey.vk_delta_2;
  const ic = vkey.IC;

  console.log('\nAlpha (G1 point):');
  console.log(JSON.stringify(alpha_g1, null, 2));

  console.log('\nBeta (G2 point):');
  console.log(JSON.stringify(beta_g2, null, 2));

  console.log('\nGamma (G2 point):');
  console.log(JSON.stringify(gamma_g2, null, 2));

  console.log('\nDelta (G2 point):');
  console.log(JSON.stringify(delta_g2, null, 2));

  console.log(`\nIC points (${ic.length} points):`);
  ic.forEach((point, i) => {
    console.log(`IC[${i}]: ${JSON.stringify(point)}`);
  });

  // Generate Rust code for Solana program
  console.log('\n' + '='.repeat(60));
  console.log('Rust code for Solana program (copy to lib.rs):');
  console.log('='.repeat(60));
  console.log(`
// Verification key constants (generated from circuit)
const VK_ALPHA_G1: [u8; 64] = [
    // X coordinate (32 bytes)
    ${g1ToBytes(alpha_g1[0]).join(', ')},
    // Y coordinate (32 bytes)
    ${g1ToBytes(alpha_g1[1]).join(', ')},
];

const VK_BETA_G2: [u8; 128] = [
    // X1 coordinate (32 bytes)
    ${g2ToBytes(beta_g2[0][0]).join(', ')},
    // X2 coordinate (32 bytes)
    ${g2ToBytes(beta_g2[0][1]).join(', ')},
    // Y1 coordinate (32 bytes)
    ${g2ToBytes(beta_g2[1][0]).join(', ')},
    // Y2 coordinate (32 bytes)
    ${g2ToBytes(beta_g2[1][1]).join(', ')},
];

const VK_GAMMA_G2: [u8; 128] = [
    ${g2ToBytes(gamma_g2[0][0]).join(', ')},
    ${g2ToBytes(gamma_g2[0][1]).join(', ')},
    ${g2ToBytes(gamma_g2[1][0]).join(', ')},
    ${g2ToBytes(gamma_g2[1][1]).join(', ')},
];

const VK_DELTA_G2: [u8; 128] = [
    ${g2ToBytes(delta_g2[0][0]).join(', ')},
    ${g2ToBytes(delta_g2[0][1]).join(', ')},
    ${g2ToBytes(delta_g2[1][0]).join(', ')},
    ${g2ToBytes(delta_g2[1][1]).join(', ')},
];

const VK_IC: [[u8; 64]; ${ic.length}] = [
${ic.map(point => `    [
        ${g1ToBytes(point[0]).join(', ')},
        ${g1ToBytes(point[1]).join(', ')},
    ]`).join(',\n')}
];
  `);

  // Save to file
  const outputPath = path.join(__dirname, 'build', 'vkey_constants.rs');
  const rustCode = generateRustCode(alpha_g1, beta_g2, gamma_g2, delta_g2, ic);
  fs.writeFileSync(outputPath, rustCode);
  console.log(`\nRust code saved to: ${outputPath}`);
}

function g1ToBytes(coordinate) {
  // Convert field element string to bytes
  const hex = BigInt(coordinate).toString(16).padStart(64, '0');
  const bytes = [];
  for (let i = 0; i < 64; i += 2) {
    bytes.push(`0x${hex.substr(i, 2)}`);
  }
  return bytes;
}

function g2ToBytes(coordinate) {
  return g1ToBytes(coordinate);
}

function generateRustCode(alpha_g1, beta_g2, gamma_g2, delta_g2, ic) {
  return `// Auto-generated verification key constants
// Generated from circuit compilation
// DO NOT EDIT MANUALLY

pub const VK_ALPHA_G1: [u8; 64] = [
    ${g1ToBytes(alpha_g1[0]).join(', ')},
    ${g1ToBytes(alpha_g1[1]).join(', ')},
];

pub const VK_BETA_G2: [u8; 128] = [
    ${g2ToBytes(beta_g2[0][0]).join(', ')},
    ${g2ToBytes(beta_g2[0][1]).join(', ')},
    ${g2ToBytes(beta_g2[1][0]).join(', ')},
    ${g2ToBytes(beta_g2[1][1]).join(', ')},
];

pub const VK_GAMMA_G2: [u8; 128] = [
    ${g2ToBytes(gamma_g2[0][0]).join(', ')},
    ${g2ToBytes(gamma_g2[0][1]).join(', ')},
    ${g2ToBytes(gamma_g2[1][0]).join(', ')},
    ${g2ToBytes(gamma_g2[1][1]).join(', ')},
];

pub const VK_DELTA_G2: [u8; 128] = [
    ${g2ToBytes(delta_g2[0][0]).join(', ')},
    ${g2ToBytes(delta_g2[0][1]).join(', ')},
    ${g2ToBytes(delta_g2[1][0]).join(', ')},
    ${g2ToBytes(delta_g2[1][1]).join(', ')},
];

pub const VK_IC: [[u8; 64]; ${ic.length}] = [
${ic.map(point => `    [
        ${g1ToBytes(point[0]).join(', ')},
        ${g1ToBytes(point[1]).join(', ')},
    ]`).join(',\n')}
];
`;
}

// Run if called directly
if (require.main === module) {
  loadVerificationKey().catch(console.error);
}

module.exports = { loadVerificationKey };
