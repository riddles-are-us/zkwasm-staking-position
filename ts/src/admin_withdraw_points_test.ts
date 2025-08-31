import { PrivateKey, bnToHexLe } from "delphinus-curves/src/altjubjub";
import dotenv from 'dotenv';
import { PlayerConvention, ZKWasmAppRpc, createCommand, createWithdrawCommand } from 'zkwasm-minirollup-rpc';
import { LeHexBN } from "zkwasm-ts-server";

dotenv.config();

// Command constants
const WITHDRAW_POINTS = 5;
const INSTALL_PLAYER = 1;

class AdminPointsWithdrawal extends PlayerConvention {
    constructor(key: string, rpc: ZKWasmAppRpc) {
        super(key, rpc, BigInt(INSTALL_PLAYER), BigInt(WITHDRAW_POINTS));
        this.processingKey = key;
        this.rpc = rpc;
    }

    async sendTransactionWithCommand(cmd: BigUint64Array) {
        try {
            let result = await this.rpc.sendTransaction(cmd, this.processingKey);
            return result;
        } catch (e) {
            if (e instanceof Error) {
                console.log(e.message);
            }
            throw e;
        }
    }

    async installPlayer() {
        try {
            let cmd = createCommand(0n, BigInt(INSTALL_PLAYER), []);
            return await this.sendTransactionWithCommand(cmd);
        } catch (e) {
            if (e instanceof Error && e.message === "PlayerAlreadyExists") {
                console.log("Admin already exists, skipping installation");
                return null;
            }
            throw e;
        }
    }

    async adminWithdrawPoints(pointsAmount: bigint, address: string) {
        let nonce = await this.getNonce();
        // Admin withdraw points - mint from thin air
        let cmd = createWithdrawCommand(nonce, BigInt(WITHDRAW_POINTS), address, 2n, pointsAmount);
        console.log(`Admin withdrawing ${pointsAmount} points from thin air`);
        return await this.sendTransactionWithCommand(cmd);
    }
}

async function testAdminWithdrawPoints() {
    console.log("=== Admin Points Withdrawal Test ===");
    
    const rpc = new ZKWasmAppRpc("https://rpc.staking.zkwasm.ai");
    const targetAddress = "0x55244491F6f46a5A6E1b2d8F0b7EE1856D4aA5dc";
    
    // Use environment variable for admin key
    const adminKey = process.env.SERVER_ADMIN_KEY;
    if (!adminKey) {
        throw new Error("SERVER_ADMIN_KEY environment variable is required");
    }
    
    console.log("Using admin key from environment");
    console.log(`Target address: ${targetAddress}`);
    
    try {
        // Create admin instance
        const admin = new AdminPointsWithdrawal(adminKey, rpc);
        
        // Ensure admin is installed
        try {
            await admin.installPlayer();
            console.log("Admin installation checked");
        } catch (error) {
            console.error("❌ Admin installation failed:", error);
        }
        
        // Test admin points withdrawal - mint 1 billion points from thin air
        const amount = 100000000n; // 1 billion points
        console.log(`\nTesting admin withdrawal of ${amount} points to address ${targetAddress}`);
        
        try {
            await admin.adminWithdrawPoints(amount, targetAddress);
            console.log(`✅ Admin withdrawal successful: ${amount} points to ${targetAddress}`);
        } catch (error) {
            console.error(`❌ Admin withdrawal failed for ${amount} points:`, error);
        }
        
        console.log("\n✅ Admin points withdrawal test completed!");
        
    } catch (error) {
        console.error("❌ Admin points withdrawal test failed:", error);
        if (error instanceof Error) {
            console.error("Error message:", error.message);
        }
    }
}

// Export functions for use in other scripts
export { AdminPointsWithdrawal, testAdminWithdrawPoints };

// Run script if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    testAdminWithdrawPoints().catch(console.error);
}