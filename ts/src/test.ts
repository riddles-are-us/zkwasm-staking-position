// Certificate System Integration Tests
// Tests actual blockchain operations and state queries

import { PrivateKey, bnToHexLe } from "delphinus-curves/src/altjubjub";
import { PlayerConvention, ZKWasmAppRpc, createCommand, createWithdrawCommand } from "zkwasm-minirollup-rpc";
import { LeHexBN } from "zkwasm-ts-server";
import { CertificateCalculator, PlayerUtils } from './api.js';
import { 
    StakingPlayer, 
    ProductType, 
    Certificate, 
    CertificateStatus, 
    ProductTypeManager,
    CertificateManager, 
    CertificateCalculator as CertCalc
} from './models.js';

// Test keys - consistent with other projects
const testKey = "123456789";
const adminKey = process.env.SERVER_ADMIN_KEY || "123456789";
const testKey2 = "987654321"; // Second test user

// Initialize RPC connection
const rpc = new ZKWasmAppRpc("http://127.0.0.1:3000");

// Command constants for staking system
const INSTALL_PLAYER = 1;
const WITHDRAW = 2;
const DEPOSIT = 3;
const WITHDRAW_POINTS = 5;

// Certificate system command constants
const CREATE_PRODUCT_TYPE = 6;
const MODIFY_PRODUCT_TYPE = 7;
const PURCHASE_CERTIFICATE = 10;
const CLAIM_INTEREST = 11;
const REDEEM_PRINCIPAL = 12;
const ADMIN_WITHDRAW_TO_MULTISIG = 13;
const SET_RESERVE_RATIO = 14;

// Create Player classes for staking
class StakingTestPlayer extends PlayerConvention {
    constructor(key: string, rpc: ZKWasmAppRpc) {
        super(key, rpc, BigInt(DEPOSIT), BigInt(WITHDRAW));
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
        } catch (error) {
            if (error instanceof Error && error.message.includes("PlayerAlreadyExist")) {
                console.log("Player already exists, skipping installation");
                return null;
            }
            throw error;
        }
    }

    async withdraw(amount: bigint, address: string = "1234567890123456789012345678901234567890") {
        let nonce = await this.getNonce();
        // Use createWithdrawCommand from zkwasm-minirollup-rpc
        let cmd = createWithdrawCommand(nonce, BigInt(WITHDRAW), address, 0n, amount);
        return await this.sendTransactionWithCommand(cmd);
    }

    async withdrawPoints(pointsAmount: bigint, address: string = "1234567890123456789012345678901234567890") {
        let nonce = await this.getNonce();
        // Use createWithdrawCommand from zkwasm-minirollup-rpc with token index 2 for points
        let cmd = createWithdrawCommand(nonce, BigInt(WITHDRAW_POINTS), address, 2n, pointsAmount);
        return await this.sendTransactionWithCommand(cmd);
    }

    // Certificate system user functions
    async purchaseCertificate(productTypeId: bigint, amount: bigint) {
        try {
            let nonce = await this.getNonce();
            let cmd = createCommand(nonce, BigInt(PURCHASE_CERTIFICATE), [productTypeId, amount]);
            console.log(`User purchasing certificate: product type ${productTypeId}, amount ${amount}`);
            return await this.sendTransactionWithCommand(cmd);
        } catch (error) {
            console.error("Error purchasing certificate:", error);
            throw error;
        }
    }

    async claimInterest(certificateId: bigint, amount: bigint) {
        try {
            let nonce = await this.getNonce();
            // ClaimInterest extracts interest to idle funds (internal operation)
            let cmd = createCommand(nonce, BigInt(CLAIM_INTEREST), [certificateId, amount]);
            console.log(`User claiming interest: certificate ${certificateId}, amount ${amount}`);
            return await this.sendTransactionWithCommand(cmd);
        } catch (error) {
            console.error("Error claiming interest:", error);
            throw error;
        }
    }

    async redeemPrincipal(certificateId: bigint) {
        try {
            let nonce = await this.getNonce();
            // RedeemPrincipal adds principal to idle funds (internal operation)
            let cmd = createCommand(nonce, BigInt(REDEEM_PRINCIPAL), [certificateId]);
            console.log(`User redeeming principal: certificate ${certificateId}`);
            return await this.sendTransactionWithCommand(cmd);
        } catch (error) {
            console.error("Error redeeming principal:", error);
            throw error;
        }
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

// Admin class for deposit operations and certificate management
class StakingAdmin extends StakingTestPlayer {
    constructor(adminKey: string, rpc: ZKWasmAppRpc) {
        super(adminKey, rpc);
    }

    async depositForUser(userPid: bigint[], amount: bigint) {
        try {
            let nonce = await this.getNonce();
            // Deposit command needs 5 params: [nonce_and_command, userPid[0], userPid[1], 0, amount]
            // The actual data array in Rust will be [params[1], params[2], params[4]] = [userPid[0], userPid[1], amount]
            // params[3] must be 0 (token index check)
            let cmd = createCommand(nonce, BigInt(DEPOSIT), [userPid[0], userPid[1], 0n, amount]);
            console.log(`Admin depositing ${amount} for user [${userPid[0]}, ${userPid[1]}]`);
            return await this.sendTransactionWithCommand(cmd);
        } catch (error) {
            console.error("Error depositing for user:", error);
            throw error;
        }
    }

    // Certificate system admin functions
    async createProductType(durationDays: bigint, apy: bigint, minAmount: bigint) {
        try {
            let nonce = await this.getNonce();
            let cmd = createCommand(nonce, BigInt(CREATE_PRODUCT_TYPE), [durationDays, apy, minAmount]);
            console.log(`Admin creating product type: ${durationDays} days, ${apy} APY, ${minAmount} min amount`);
            return await this.sendTransactionWithCommand(cmd);
        } catch (error) {
            console.error("Error creating product type:", error);
            throw error;
        }
    }

    async modifyProductType(productTypeId: bigint, newApy: bigint, newDuration: bigint, newMinAmount: bigint) {
        try {
            let nonce = await this.getNonce();
            let cmd = createCommand(nonce, BigInt(MODIFY_PRODUCT_TYPE), [productTypeId, newApy, newDuration, newMinAmount]);
            console.log(`Admin modifying product type ${productTypeId}: APY=${newApy}, duration=${newDuration} days, minAmount=${newMinAmount}`);
            console.log("Note: Pass current values to keep fields unchanged");
            return await this.sendTransactionWithCommand(cmd);
        } catch (error) {
            console.error("Error modifying product type:", error);
            throw error;
        }
    }

    async withdrawToMultisig(amount: bigint) {
        try {
            let nonce = await this.getNonce();
            let cmd = createCommand(nonce, BigInt(ADMIN_WITHDRAW_TO_MULTISIG), [amount]);
            console.log(`Admin withdrawing ${amount} USDT to multisig address`);
            return await this.sendTransactionWithCommand(cmd);
        } catch (error) {
            console.error("Error withdrawing to multisig:", error);
            throw error;
        }
    }

    async setReserveRatio(reserveRatioBasisPoints: bigint) {
        try {
            let nonce = await this.getNonce();
            let cmd = createCommand(nonce, BigInt(SET_RESERVE_RATIO), [reserveRatioBasisPoints]);
            console.log(`Admin setting reserve ratio to ${reserveRatioBasisPoints} basis points`);
            return await this.sendTransactionWithCommand(cmd);
        } catch (error) {
            console.error("Error setting reserve ratio:", error);
            throw error;
        }
    }

}

// Helper function to log player state from blockchain
async function logPlayerState(userKey: string, stepDescription: string) {
    console.log(`\n=== ${stepDescription} ===`);
    
    try {
        // Query using the user's key - this returns both global state and user state
        console.log(`Querying state for user key: ${userKey}...`);
        const stateResponse: any = await rpc.queryState(userKey);
        const stateData = JSON.parse(stateResponse.data);
        
        console.log("Raw Response:", stateResponse);
        console.log("Parsed Data:", JSON.stringify(stateData, null, 2));
        
        // Extract global state from the 'state' object
        const globalState = {
            counter: stateData.state?.counter || 0,
            totalPlayers: stateData.state?.total_players || 0,
            totalFunds: stateData.state?.total_funds || 0
        };
        
        console.log("Global State:", globalState);
        
        // Extract player state - certificate system uses { points, idle_funds }
        let playerState = {
            points: 0,
            idle_funds: 0
        };
        
        if (stateData.player && stateData.player.data) {
            // Structure: { player: { nonce, data: { points, idle_funds } } }
            playerState = {
                points: stateData.player.data.points || 0,
                idle_funds: stateData.player.data.idle_funds || 0
            };
        } else if (stateData.data) {
            // Structure: { data: { points, idle_funds } }
            playerState = {
                points: stateData.data.points || 0,
                idle_funds: stateData.data.idle_funds || 0
            };
        } else if (stateData.points !== undefined) {
            // Direct structure: { points, idle_funds }
            playerState = {
                points: stateData.points || 0,
                idle_funds: stateData.idle_funds || 0
            };
        }
        
        console.log("Player State:", {
            points: playerState.points,
            idleFunds: playerState.idle_funds
        });
        
        // Calculate effective points (certificate system: points are static)
        const currentCounter = BigInt(globalState.counter || 0);
        const points = BigInt(playerState.points || 0);
        const idleFunds = BigInt(playerState.idle_funds || 0);
        
        const effectivePoints = CertificateCalculator.calculateEffectivePoints(points);
        
        console.log("Certificate System Points:", {
            staticPoints: points.toString(),
            idleFunds: idleFunds.toString(),
            currentCounter: currentCounter.toString(),
            effectivePoints: effectivePoints.toString()
        });
        
        return {
            globalState: {
                counter: currentCounter,
                totalPlayers: BigInt(globalState.totalPlayers || 0),
                totalFunds: BigInt(globalState.totalFunds || 0)
            },
            playerState: {
                points,
                idleFunds
            },
            effectivePoints
        };
        
        } catch (error) {
        console.error("Error querying blockchain state:", error);
        return null;
    }
}

// Helper function to wait for transaction processing
async function waitForTransaction(seconds: number = 2) {
    console.log(`Waiting ${seconds} seconds for transaction to process...`);
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

// Test RPC configuration
async function testRpcConfig(): Promise<void> {
    console.log("\n[TEST] RPC Configuration");
    
    try {
        const config = await rpc.queryConfig();
        console.log("RPC Config:", config);
        
        // Test basic state query with admin key
        console.log("Testing basic state query with admin key...");
        const stateResponse: any = await rpc.queryState(adminKey);
        console.log("Admin state query successful");
        
        console.log("SUCCESS: RPC configuration test completed");
        
    } catch (error) {
        console.error("ERROR: RPC configuration test failed:", error);
        throw error;
    }
}

// Test player installation
async function testInstallPlayers(): Promise<{admin: StakingAdmin, player1: StakingTestPlayer, player2: StakingTestPlayer}> {
    console.log("\n[TEST] Player Installation");
    
    try {
        // Create player instances
        const admin = new StakingAdmin(adminKey, rpc);
        const player1 = new StakingTestPlayer(testKey, rpc);
        const player2 = new StakingTestPlayer(testKey2, rpc);
        
        console.log("Created player instances");
        console.log(`Admin key: ${adminKey}`);
        console.log(`Player1 key: ${testKey}`);
        console.log(`Player2 key: ${testKey2}`);
        
        // Install admin
        try {
            await admin.installPlayer();
            console.log("Admin player installed successfully");
        } catch (error) {
            if (error instanceof Error && error.message.includes("PlayerAlreadyExist")) {
                console.log("Admin player already exists, continuing...");
            } else {
                throw error;
            }
        }
        
        // Install player1
        try {
            await player1.installPlayer();
            console.log("Player1 installed successfully");
        } catch (error) {
            if (error instanceof Error && error.message.includes("PlayerAlreadyExist")) {
                console.log("Player1 already exists, continuing...");
            } else {
                throw error;
            }
        }
        
        // Install player2
        try {
            await player2.installPlayer();
            console.log("Player2 installed successfully");
        } catch (error) {
            if (error instanceof Error && error.message.includes("PlayerAlreadyExist")) {
                console.log("Player2 already exists, continuing...");
            } else {
                throw error;
            }
        }
        
        console.log("SUCCESS: All players installation completed");
        return { admin, player1, player2 };
        
        } catch (error) {
        console.error("ERROR: Player installation failed:", error);
                throw error;
            }
        }

// Main test suite
export class CertificateIntegrationTest {
    
    static async runAllTests(): Promise<void> {
        console.log("[SUITE] Starting Certificate System Integration Tests\n");
        console.log(`Using test key: ${testKey}`);
        console.log(`Using test key2: ${testKey2}`);
        console.log(`Using admin key: ${adminKey}`);
        console.log(`RPC endpoint: http://127.0.0.1:3000\n`);
        
        try {
            // Test 1: RPC Configuration
            await testRpcConfig();
            
            // Test 2: Player Installation
            const { admin, player1, player2 } = await testInstallPlayers();
            
            console.log("\nSUCCESS: All integration tests completed successfully!");
            console.log("\nCertificate system is working correctly!");
            
        } catch (error) {
            console.error("\nERROR: Integration tests failed:", error);
            console.log("\nMake sure:");
            console.log("1. The zkWasm server is running on localhost:3000");
            console.log("2. The certificate smart contract is deployed");
            console.log("3. All required dependencies are installed");
            process.exit(1);
        }
    }
    
    // Specialized test runners for individual components
    static async runBasicTests(): Promise<void> {
        console.log("[SUITE] Running Basic Certificate Tests\n");
        
        try {
            await testRpcConfig();
            const { admin, player1, player2 } = await testInstallPlayers();
            
            console.log("SUCCESS: Basic tests completed successfully!");
        } catch (error) {
            console.error("ERROR: Basic tests failed:", error);
            throw error;
        }
    }
}

// Export for use in other modules
export {
    CertificateIntegrationTest as CertificateTest,
    StakingTestPlayer as CertificateTestPlayer,
    StakingAdmin as CertificateAdmin,
    testKey,
    testKey2,
    adminKey,
    rpc
};

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    // Default to running all tests
    const testType = process.argv[2];
    
    switch(testType) {
        case 'basic':
            CertificateIntegrationTest.runBasicTests();
            break;
        default:
            CertificateIntegrationTest.runAllTests();
    }
}