/**
 * Address Parser Utility for zkWasm Staking System
 * 
 * Converts Ethereum addresses to the format expected by createWithdrawCommand
 * and generates constants for use in Rust config.rs
 */

export function bytesToHex(bytes: number[]): string {
    return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Parse Ethereum address into parts compatible with createWithdrawCommand
 * Matches the exact logic from zkwasm-minirollup-rpc
 */
export function parseEthereumAddress(address: string): {
    first: bigint;
    middle: bigint; 
    last: bigint;
    firstHex: string;
    middleHex: string;
    lastHex: string;
} {
    // Remove "0x" prefix if present
    const cleanAddr = address.startsWith("0x") ? address.slice(2) : address;
    
    if (cleanAddr.length !== 40) {
        throw new Error(`Invalid Ethereum address length, expected 40 hex characters, got ${cleanAddr.length}`);
    }
    
    // Convert hex string to bytes array (big-endian, same as BN.toArray("be", 20))
    const a = [];
    for (let i = 0; i < 40; i += 2) {
        a.push(parseInt(cleanAddr.slice(i, i + 2), 16));
    }
    
    // Exact same logic as createWithdrawCommand:
    const firstLimb = BigInt('0x' + bytesToHex(a.slice(0,4).reverse()));
    const sndLimb = BigInt('0x' + bytesToHex(a.slice(4,12).reverse()));
    const thirdLimb = BigInt('0x' + bytesToHex(a.slice(12, 20).reverse()));
    
    return {
        first: firstLimb,
        middle: sndLimb,
        last: thirdLimb,
        firstHex: '0x' + firstLimb.toString(16),
        middleHex: '0x' + sndLimb.toString(16), 
        lastHex: '0x' + thirdLimb.toString(16)
    };
}

/**
 * Generate Rust constants for config.rs from an Ethereum address
 */
export function generateRustConstants(address: string, constantPrefix: string = "MULTISIG"): string {
    const parsed = parseEthereumAddress(address);
    
    return `// Generated from address: ${address}
pub const ${constantPrefix}_FIRST: u64 = ${parsed.firstHex};   // First 4 bytes (reversed)
pub const ${constantPrefix}_MIDDLE: u64 = ${parsed.middleHex}; // Middle 8 bytes (reversed) 
pub const ${constantPrefix}_LAST: u64 = ${parsed.lastHex};   // Last 8 bytes (reversed)`;
}

/**
 * Command-line utility function for easy address conversion
 */
export function convertAddress(address: string): void {
    try {
        console.log(`Converting address: ${address}\n`);
        
        const parsed = parseEthereumAddress(address);
        
        console.log("Parsed parts:");
        console.log(`  First:  ${parsed.first} (${parsed.firstHex})`);
        console.log(`  Middle: ${parsed.middle} (${parsed.middleHex})`);
        console.log(`  Last:   ${parsed.last} (${parsed.lastHex})`);
        
        console.log("\nRust constants:");
        console.log(generateRustConstants(address));
        
        console.log("\nTypeScript usage:");
        console.log(`const addressParts = [${parsed.firstHex}, ${parsed.middleHex}, ${parsed.lastHex}];`);
        
    } catch (error) {
        console.error("Error:", error instanceof Error ? error.message : String(error));
    }
}

// CLI usage: node -e "require('./address_parser.js').convertAddress('0x742d35cc6cbf4f0b64d8b5b5db5be5e9e2c0c7b8')"
if (require.main === module) {
    const address = process.argv[2];
    if (!address) {
        console.log("Usage: node address_parser.js <ethereum_address>");
        console.log("Example: node address_parser.js 0x742d35cc6cbf4f0b64d8b5b5db5be5e9e2c0c7b8");
        process.exit(1);
    }
    convertAddress(address);
}