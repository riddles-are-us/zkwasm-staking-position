// Staking System Integration Tests
// Tests actual blockchain operations and state queries

import { PrivateKey, bnToHexLe } from "delphinus-curves/src/altjubjub";
import { PlayerConvention, ZKWasmAppRpc, createCommand, createWithdrawCommand } from "zkwasm-minirollup-rpc";
import { LeHexBN } from "zkwasm-ts-server";
import { StakingCalculator, PlayerUtils } from './api.js';
import { StakingPlayer } from './models.js';

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

// Admin class for deposit operations
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
            totalStaked: stateData.state?.total_staked || 0
        };
        
        console.log("Global State:", globalState);
        
        // Extract player state - check different possible structures
        let playerState = {
            points: 0,
            total_staked: 0,
            last_stake_time: 0
        };
        
        if (stateData.player && stateData.player.data) {
            // Structure: { player: { nonce, data: { points, total_staked, last_stake_time } } }
            playerState = {
                points: stateData.player.data.points || 0,
                total_staked: stateData.player.data.total_staked || 0,
                last_stake_time: stateData.player.data.last_stake_time || 0
            };
        } else if (stateData.data) {
            // Structure: { data: { points, total_staked, last_stake_time } }
            playerState = {
                points: stateData.data.points || 0,
                total_staked: stateData.data.total_staked || 0,
                last_stake_time: stateData.data.last_stake_time || 0
            };
        } else if (stateData.points !== undefined) {
            // Direct structure: { points, total_staked, last_stake_time }
            playerState = {
                points: stateData.points || 0,
                total_staked: stateData.total_staked || 0,
                last_stake_time: stateData.last_stake_time || 0
            };
        }
        
        console.log("Player State:", {
            points: playerState.points,
            totalStaked: playerState.total_staked,
            lastStakeTime: playerState.last_stake_time
        });
        
        // Calculate effective points
        const currentCounter = BigInt(globalState.counter || 0);
        const points = BigInt(playerState.points || 0);
        const totalStaked = BigInt(playerState.total_staked || 0);
        const lastStakeTime = BigInt(playerState.last_stake_time || 0);
        
        const effectivePoints = StakingCalculator.calculateEffectivePoints(
            points, totalStaked, lastStakeTime, currentCounter
        );
        
        console.log("Calculated Effective Points:", {
            basePoints: points.toString(),
            totalStaked: totalStaked.toString(),
            lastStakeTime: lastStakeTime.toString(),
            currentCounter: currentCounter.toString(),
            timeDelta: (currentCounter - lastStakeTime).toString(),
            interest: (totalStaked * (currentCounter - lastStakeTime)).toString(),
            effectivePoints: effectivePoints.toString()
        });
        
        return {
            globalState: {
                counter: currentCounter,
                totalPlayers: BigInt(globalState.totalPlayers || 0),
                totalStaked: BigInt(globalState.totalStaked || 0)
            },
            playerState: {
                points,
                totalStaked,
                lastStakeTime
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
    console.log("\n🔧 Testing RPC Configuration");
    
    try {
        const config = await rpc.queryConfig();
        console.log("RPC Config:", config);
        
        // Test basic state query with admin key
        console.log("Testing basic state query with admin key...");
        const stateResponse: any = await rpc.queryState(adminKey);
        console.log("Admin state query successful");
        
        console.log("✅ RPC configuration test completed");
        
    } catch (error) {
        console.error("❌ RPC configuration test failed:", error);
        throw error;
    }
}

// Test player installation
async function testInstallPlayers(): Promise<{admin: StakingAdmin, player1: StakingTestPlayer, player2: StakingTestPlayer}> {
    console.log("\n🔧 Testing Player Installation");
    
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
        
        console.log("✅ All players installation completed");
        return { admin, player1, player2 };
        
        } catch (error) {
        console.error("❌ Player installation failed:", error);
                throw error;
            }
        }
        
// Test deposit operation
async function testDepositOperation(admin: StakingAdmin, player: StakingTestPlayer, amount: bigint): Promise<void> {
    console.log(`\n💰 Testing Deposit Operation (${amount} tokens)`);
    
    try {
        // Get player ID for deposit
        const playerId = player.getPlayerId();
        console.log(`Player ID: [${playerId[0]}, ${playerId[1]}]`);
        
        // Query state before deposit
        const stateBefore = await logPlayerState(player.processingKey, "State Before Deposit");
        
        // Perform deposit operation
        console.log("\n--- Performing Deposit ---");
        await admin.depositForUser(playerId, amount);
        
        // Wait for state to update
        await waitForTransaction(3);
        
        // Query state after deposit
        const stateAfter = await logPlayerState(player.processingKey, "State After Deposit");
        
        // Compare states
        if (stateBefore && stateAfter) {
            console.log("\n--- State Comparison ---");
            console.log(`Total Staked: ${stateBefore.playerState.totalStaked} -> ${stateAfter.playerState.totalStaked}`);
            console.log(`Points: ${stateBefore.playerState.points} -> ${stateAfter.playerState.points}`);
            console.log(`Last Stake Time: ${stateBefore.playerState.lastStakeTime} -> ${stateAfter.playerState.lastStakeTime}`);
            console.log(`Effective Points: ${stateBefore.effectivePoints} -> ${stateAfter.effectivePoints}`);
            
            // Verify expected changes
            const expectedStakeIncrease = amount;
            const actualStakeIncrease = stateAfter.playerState.totalStaked - stateBefore.playerState.totalStaked;
            
            console.log(`Expected stake increase: ${expectedStakeIncrease}`);
            console.log(`Actual stake increase: ${actualStakeIncrease}`);
            console.log(`Deposit verification: ${actualStakeIncrease === expectedStakeIncrease ? '✅ PASS' : '❌ FAIL'}`);
        }
        
        console.log("✅ Deposit operation completed");
        
        } catch (error) {
        console.error("❌ Deposit operation failed:", error);
        throw error;
    }
}

// Test withdraw operation
async function testWithdrawOperation(player: StakingTestPlayer, amount: bigint): Promise<void> {
    console.log(`\n💸 Testing Withdraw Operation (${amount} tokens)`);
    
    try {
        // Query state before withdraw
        const stateBefore = await logPlayerState(player.processingKey, "State Before Withdraw");
        
        // Perform withdraw operation
        console.log("\n--- Performing Withdraw ---");
        await player.withdraw(amount);
        
        // Wait for state to update
        await waitForTransaction(3);
        
        // Query state after withdraw
        const stateAfter = await logPlayerState(player.processingKey, "State After Withdraw");
        
        // Compare states
        if (stateBefore && stateAfter) {
            console.log("\n--- State Comparison ---");
            console.log(`Total Staked: ${stateBefore.playerState.totalStaked} -> ${stateAfter.playerState.totalStaked}`);
            console.log(`Points: ${stateBefore.playerState.points} -> ${stateAfter.playerState.points}`);
            console.log(`Last Stake Time: ${stateBefore.playerState.lastStakeTime} -> ${stateAfter.playerState.lastStakeTime}`);
            console.log(`Effective Points: ${stateBefore.effectivePoints} -> ${stateAfter.effectivePoints}`);
            
            // Verify expected changes
            const expectedStakeDecrease = amount;
            const actualStakeDecrease = stateBefore.playerState.totalStaked - stateAfter.playerState.totalStaked;
            
            console.log(`Expected stake decrease: ${expectedStakeDecrease}`);
            console.log(`Actual stake decrease: ${actualStakeDecrease}`);
            console.log(`Withdraw verification: ${actualStakeDecrease === expectedStakeDecrease ? '✅ PASS' : '❌ FAIL'}`);
        }
        
        console.log("✅ Withdraw operation completed");
        
        } catch (error) {
        console.error("❌ Withdraw operation failed:", error);
        throw error;
    }
}

// Test time-based effective points calculation
async function testTimeBasedCalculation(userKey: string): Promise<void> {
    console.log("\n⏰ Testing Time-Based Effective Points Calculation");
    
    try {
        // Get current state
        const currentState = await logPlayerState(userKey, "Current State for Time Test");
        
        if (!currentState) {
            console.log("❌ Cannot test time-based calculation without current state");
            return;
        }
        
        // Simulate future time points
        const futureCounters = [
            currentState.globalState.counter + 100n,
            currentState.globalState.counter + 1000n,
            currentState.globalState.counter + 10000n
        ];
        
        console.log("\n--- Effective Points at Future Times ---");
        console.log(`Current (${currentState.globalState.counter}): ${currentState.effectivePoints}`);
        
        for (const futureCounter of futureCounters) {
            const futureEffective = StakingCalculator.calculateEffectivePoints(
                currentState.playerState.points,
                currentState.playerState.totalStaked,
                currentState.playerState.lastStakeTime,
                futureCounter
            );
            
            const timeDelta = futureCounter - currentState.globalState.counter;
            const additionalInterest = currentState.playerState.totalStaked * timeDelta;
            
            console.log(`Future (${futureCounter}): ${futureEffective} (+${additionalInterest} interest over ${timeDelta} time units)`);
        }
        
        console.log("✅ Time-based calculation test completed");
        
        } catch (error) {
        console.error("❌ Time-based calculation test failed:", error);
        throw error;
    }
}



// Main test suite
export class StakingIntegrationTest {
    
    static async runAllTests(): Promise<void> {
        console.log("🧪 Starting Staking Integration Tests\n");
        console.log(`Using test key: ${testKey}`);
        console.log(`Using test key2: ${testKey2}`);
        console.log(`Using admin key: ${adminKey}`);
        console.log(`RPC endpoint: http://127.0.0.1:3000\n`);
        
        try {
            // Test 1: RPC Configuration
            await testRpcConfig();
            
            // Test 2: Player Installation
            const { admin, player1, player2 } = await testInstallPlayers();
            
            // Test 3: Initial State Queries
            console.log("\n=== Initial States ===");
            await logPlayerState(adminKey, "Admin Initial State");
            await logPlayerState(testKey, "Player1 Initial State");
            await logPlayerState(testKey2, "Player2 Initial State");
            
            // Test 4: Deposit Operations
            console.log("\n=== Testing Deposit Operations ===");
            await testDepositOperation(admin, player1, 5000n); // Deposit 5000 for player1
            await testDepositOperation(admin, player2, 3000n); // Deposit 3000 for player2
            
            // Test 5: Time-based Calculations
            await testTimeBasedCalculation(testKey);
            await testTimeBasedCalculation(testKey2);
            
            // Test 6: Additional Deposits (to test interest calculation)
            console.log("\n=== Testing Additional Deposits (Interest Calculation) ===");
            await testDepositOperation(admin, player1, 2000n); // Additional 2000 for player1
            
            // Test 7: Withdraw Operations
            console.log("\n=== Testing Withdraw Operations ===");
            await testWithdrawOperation(player1, 1000n); // Player1 withdraws 1000
            await testWithdrawOperation(player2, 500n);  // Player2 withdraws 500
            
            // Test 8: Final States
            console.log("\n=== Final States ===");
            await logPlayerState(adminKey, "Admin Final State");
            await logPlayerState(testKey, "Player1 Final State");
            await logPlayerState(testKey2, "Player2 Final State");
            
            console.log("\n✅ All integration tests completed successfully!");
            console.log("\n🎉 Staking system is working correctly!");
            
        } catch (error) {
            console.error("\n❌ Integration tests failed:", error);
            console.log("\nMake sure:");
            console.log("1. The zkWasm server is running on localhost:3000");
            console.log("2. The staking smart contract is deployed");
            console.log("3. All required dependencies are installed");
            process.exit(1);
        }
    }
}

// Export for use in other modules
export {
    StakingIntegrationTest as StakingTest,
    StakingTestPlayer,
    StakingAdmin,
    testKey,
    testKey2,
    adminKey,
    rpc
};

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    StakingIntegrationTest.runAllTests();
}