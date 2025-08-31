import { PrivateKey, bnToHexLe } from "delphinus-curves/src/altjubjub";
import dotenv from 'dotenv';
import { PlayerConvention, ZKWasmAppRpc, createCommand } from 'zkwasm-minirollup-rpc';
import { LeHexBN } from "zkwasm-ts-server";

dotenv.config();

// Command constants for IDO launchpad
const DEPOSIT_USDT = 3;
const INSTALL_PLAYER = 1;

class LaunchpadAdmin extends PlayerConvention {
    constructor(key: string, rpc: ZKWasmAppRpc) {
        super(key, rpc, BigInt(DEPOSIT_USDT), BigInt(2)); // WITHDRAW_USDT = 2
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

    async depositUsdt(amount: bigint, targetPid1: bigint, targetPid2: bigint) {
        let nonce = await this.getNonce();
        let cmd = createCommand(nonce, BigInt(DEPOSIT_USDT), [targetPid1, targetPid2, 0n, amount]);
        return await this.sendTransactionWithCommand(cmd);
    }
}

async function adminUsdtDeposit() {
    console.log("=== IDO Launchpad Admin USDT Deposit Script ===");
    
    const rpc = new ZKWasmAppRpc("https://rpc.staking.zkwasm.ai");
    
    // Use environment variable for admin key
    const adminKey = process.env.SERVER_ADMIN_KEY;
    if (!adminKey) {
        throw new Error("SERVER_ADMIN_KEY environment variable is required");
    }
    
    console.log("Admin key from env:", adminKey);
    
    try {
        // Create admin instance
        const admin = new LaunchpadAdmin(adminKey, rpc);
        
        // Ensure admin is installed
        try {
            await admin.installPlayer();
            console.log("Admin installation checked");
        } catch (error) {
            console.error("❌ Admin installation failed:", error);
        }
        console.log("Admin installation checked");
        
        // Target user PIDs (example - replace with actual user PIDs)
        const targetUsers = [
            {
                name: "Investor1",
                pid1: 715589916934578033n,
                pid2: 276680446414745649n,
                amount: 1n // 9139 USDT (6 decimals)
            },
        ];
        
        // Deposit USDT for each user
        for (const user of targetUsers) {
            console.log(`\nDepositing ${user.amount} USDT for ${user.name}`);
            console.log(`Target PID: [${user.pid1}, ${user.pid2}]`);
            
            try {
                await admin.depositUsdt(user.amount, user.pid1, user.pid2);
                console.log(`✅ Deposit successful for ${user.name}!`);
            } catch (error) {
                console.error(`❌ Deposit failed for ${user.name}:`, error);
            }
            
            // Wait a bit between deposits
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log("\n=== All deposits completed ===");
        
    } catch (error) {
        console.error("❌ Admin deposit script failed:", error);
        if (error instanceof Error) {
            console.error("Error message:", error.message);
        }
    }
}

// Bulk deposit function for multiple users
async function bulkUsdtDeposit(deposits: Array<{name: string, pid1: bigint, pid2: bigint, amount: bigint}>) {
    console.log("=== Bulk USDT Deposit ===");
    
    const rpc = new ZKWasmAppRpc("https://rpc.staking.zkwasm.ai");
    const adminKey = process.env.SERVER_ADMIN_KEY;
    
    if (!adminKey) {
        throw new Error("SERVER_ADMIN_KEY environment variable is required");
    }
    
    const admin = new LaunchpadAdmin(adminKey, rpc);
    await admin.installPlayer();
    
    let successful = 0;
    let failed = 0;
    
    for (const deposit of deposits) {
        try {
            console.log(`Depositing ${deposit.amount} USDT for ${deposit.name}...`);
            await admin.depositUsdt(deposit.amount, deposit.pid1, deposit.pid2);
            console.log(`✅ Success: ${deposit.name}`);
            successful++;
        } catch (error) {
            console.error(`❌ Failed: ${deposit.name} - ${error}`);
            failed++;
        }
        
        // Wait between deposits to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\n=== Bulk Deposit Summary ===`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total: ${deposits.length}`);
}

// Export functions for use in other scripts
export { LaunchpadAdmin, adminUsdtDeposit, bulkUsdtDeposit };

// Run script if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    adminUsdtDeposit().catch(console.error);
}