import { PrivateKey, bnToHexLe } from "delphinus-curves/src/altjubjub";
import dotenv from 'dotenv';
import { PlayerConvention, ZKWasmAppRpc, createCommand, createWithdrawCommand } from 'zkwasm-minirollup-rpc';
import { LeHexBN } from "zkwasm-ts-server";

dotenv.config();

// Command constants for points withdrawal
const WITHDRAW_POINTS = 5;
const INSTALL_PLAYER = 1;

class PointsWithdrawalPlayer extends PlayerConvention {
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
                console.log("Player already exists, skipping installation");
                return null;
            }
            throw e;
        }
    }

    async withdrawPoints(pointsAmount: bigint, address: string = "1234567890123456789012345678901234567890") {
        let nonce = await this.getNonce();
        // Use createWithdrawCommand with token index 2 for points
        let cmd = createWithdrawCommand(nonce, BigInt(WITHDRAW_POINTS), address, 2n, pointsAmount);
        console.log(`Withdrawing ${pointsAmount} points (effective amount: ${pointsAmount * 17280n})`);
        return await this.sendTransactionWithCommand(cmd);
    }

    // Get user's player ID using the same method as other projects
    getPlayerId(): bigint[] {
        try {
            // Generate PID using the same method as zkwasm-launchpad
            let pkey = PrivateKey.fromString(this.processingKey);
            let pubkey = pkey.publicKey.key.x.v;
            let leHexBN = new LeHexBN(bnToHexLe(pubkey));
            let pkeyArray = leHexBN.toU64Array();
            
            // Return first 2 elements as player ID
            return [pkeyArray[1], pkeyArray[2]];
        } catch (error) {
            console.error("Error generating player ID:", error);
            throw error;
        }
    }
}

async function testPointsWithdrawal() {
    console.log("=== Points Withdrawal Test ===");
    
    const rpc = new ZKWasmAppRpc("http://localhost:3000");
    
    // Use test key for demonstration
    const testKey = "123456789";
    
    try {
        // Create player instance
        const player = new PointsWithdrawalPlayer(testKey, rpc);
        
        // Ensure player is installed
        try {
            await player.installPlayer();
            console.log("Player installation checked");
        } catch (error) {
            console.error("❌ Player installation failed:", error);
        }
        
        // Test points withdrawal
        const pointsAmount = 1n; // 1 effective point (will require 17280 actual points)
        console.log(`\nTesting points withdrawal of ${pointsAmount} effective points`);
        console.log(`This requires ${pointsAmount * 17280n} actual points`);
        
        try {
            await player.withdrawPoints(pointsAmount);
            console.log("✅ Points withdrawal successful!");
        } catch (error) {
            console.error("❌ Points withdrawal failed:", error);
        }
        
    } catch (error) {
        console.error("❌ Points withdrawal test failed:", error);
        if (error instanceof Error) {
            console.error("Error message:", error.message);
        }
    }
}

// Bulk points withdrawal function for multiple amounts
async function bulkPointsWithdrawal(amounts: bigint[]) {
    console.log("=== Bulk Points Withdrawal ===");
    
    const rpc = new ZKWasmAppRpc("http://localhost:3000");
    const testKey = "123456789";
    
    const player = new PointsWithdrawalPlayer(testKey, rpc);
    await player.installPlayer();
    
    let successful = 0;
    let failed = 0;
    
    for (const amount of amounts) {
        try {
            console.log(`Withdrawing ${amount} effective points (${amount * 17280n} actual points)...`);
            await player.withdrawPoints(amount);
            console.log(`✅ Success: ${amount} effective points`);
            successful++;
        } catch (error) {
            console.error(`❌ Failed: ${amount} effective points - ${error}`);
            failed++;
        }
        
        // Wait between withdrawals to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\n=== Bulk Withdrawal Summary ===`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total: ${amounts.length}`);
}

// Export functions for use in other scripts
export { PointsWithdrawalPlayer, testPointsWithdrawal, bulkPointsWithdrawal };

// Run script if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    testPointsWithdrawal().catch(console.error);
} 