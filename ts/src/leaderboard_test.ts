// Leaderboard Test Script
// Tests the /data/players/:start endpoint and builds a complete leaderboard

import { ZKWasmAppRpc } from "zkwasm-minirollup-rpc";
import { CertificateCalculator } from './api.js';

// Initialize RPC connection
const rpc = new ZKWasmAppRpc("http://127.0.0.1:3000");

// Types for leaderboard data (based on mongoose schema)
interface PlayerAccount {
    pkx: string;
    index: number;
    data: {
        nonce: number;
        data: {
            points: number;
            idle_funds: number;
        };
    } | null;
}

interface LeaderboardEntry {
    pkx: string;
    rank: number;
    points: bigint;
    idleFunds: bigint;
    effectivePoints: bigint;
    index: number;
}

interface PlayersResponse {
    success: boolean;
    data: PlayerAccount[];
}

// Get players list from the endpoint
async function getPlayersList(start: number = 0): Promise<PlayersResponse> {
    try {
        console.log(`Fetching players list starting from index ${start}...`);
        
        // Make HTTP request to the players endpoint
        const response = await fetch(`http://127.0.0.1:3000/data/players/${start}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`✅ Successfully fetched ${data.data?.length || 0} players`);
        
        return data;
    } catch (error) {
        console.error(`❌ Error fetching players list:`, error);
        return { success: false, data: [] };
    }
}

// Convert PlayerAccount to LeaderboardEntry with effective points calculation
function convertToLeaderboardEntry(player: PlayerAccount, globalCounter: number): LeaderboardEntry {
    // Handle nested data structure: player.data.data contains the actual player data
    const playerData = player.data?.data;
    const points = BigInt(playerData?.points || 0);
    const idleFunds = BigInt(playerData?.idle_funds || 0);
    
    // Certificate system: points are static
    const effectivePoints = CertificateCalculator.calculateEffectivePoints(points);
    
    return {
        pkx: player.pkx,
        rank: 0, // Will be set after sorting
        points,
        idleFunds,
        effectivePoints,
        index: player.index
    };
}

// Build complete leaderboard with detailed data
async function buildLeaderboard(maxPlayers: number = 20): Promise<LeaderboardEntry[]> {
    console.log(`\n🏆 Building leaderboard (max ${maxPlayers} players)...`);
    
    try {
        // Step 1: Get player list with data
        const playersList = await getPlayersList(0);
        
        if (!playersList.success || !playersList.data || playersList.data.length === 0) {
            console.log("⚠️  No players found or API call failed");
            return [];
        }
        
        console.log(`📋 Found ${playersList.data.length} total players`);
        
        // Step 2: Filter out players with no data and limit to maxPlayers
        const validPlayers = playersList.data.filter(player => player.data !== null);
        const playersToProcess = validPlayers.slice(0, maxPlayers);
        const detailedPlayers: LeaderboardEntry[] = [];
        
        // Use current timestamp as global counter approximation
        const globalCounter = Math.floor(Date.now() / 1000);
        
        console.log(`🔍 Processing ${playersToProcess.length} players (filtered from ${playersList.data.length} total)...`);
        
        for (let i = 0; i < playersToProcess.length; i++) {
            const player = playersToProcess[i];
            console.log(`  [${i + 1}/${playersToProcess.length}] Processing player: ${player.pkx.substring(0, 10)}...`);
            
            const leaderboardEntry = convertToLeaderboardEntry(player, globalCounter);
            detailedPlayers.push(leaderboardEntry);
        }
        
        // Step 3: Sort by effective points (descending)
        detailedPlayers.sort((a, b) => {
            if (a.effectivePoints > b.effectivePoints) return -1;
            if (a.effectivePoints < b.effectivePoints) return 1;
            return 0;
        });
        
        // Step 4: Assign ranks
        detailedPlayers.forEach((player, index) => {
            player.rank = index + 1;
        });
        
        console.log(`✅ Successfully built leaderboard with ${detailedPlayers.length} players`);
        return detailedPlayers;
        
    } catch (error) {
        console.error("❌ Error building leaderboard:", error);
        return [];
    }
}

// Display leaderboard in a formatted table
function displayLeaderboard(leaderboard: LeaderboardEntry[]): void {
    console.log("\n" + "=".repeat(120));
    console.log("🏆 ZKWASM STAKING LEADERBOARD");
    console.log("=".repeat(120));
    
    if (leaderboard.length === 0) {
        console.log("No players found in leaderboard");
        return;
    }
    
    // Table header
    console.log(
        "Rank".padEnd(6) +
        "Player Key".padEnd(20) +
        "Idle Funds".padEnd(15) +
        "Base Points".padEnd(15) +
        "Effective Points".padEnd(18) +
        "Index".padEnd(16) +
        "Nonce".padEnd(8)
    );
    console.log("-".repeat(120));
    
    // Table rows
    for (const player of leaderboard) {
        const truncatedKey = player.pkx.length > 18 ? 
            player.pkx.substring(0, 8) + "..." + player.pkx.substring(player.pkx.length - 7) : 
            player.pkx;
            
        console.log(
            `#${player.rank}`.padEnd(6) +
            truncatedKey.padEnd(20) +
            player.idleFunds.toString().padEnd(15) +
            player.points.toString().padEnd(15) +
            player.effectivePoints.toString().padEnd(18) +
            player.index.toString().padEnd(16) +
            player.index.toString().padEnd(8)
        );
    }
    
    console.log("-".repeat(120));
    console.log(`Total players: ${leaderboard.length}`);
    
    // Summary statistics
    if (leaderboard.length > 0) {
        const totalIdleFunds = leaderboard.reduce((sum, player) => sum + player.idleFunds, 0n);
        const totalEffectivePoints = leaderboard.reduce((sum, player) => sum + player.effectivePoints, 0n);
        const avgIdleFunds = totalIdleFunds / BigInt(leaderboard.length);
        const avgEffectivePoints = totalEffectivePoints / BigInt(leaderboard.length);
        
        console.log("\n📊 LEADERBOARD STATISTICS:");
        console.log(`   Total Idle Funds: ${totalIdleFunds}`);
        console.log(`   Total Effective Points: ${totalEffectivePoints}`);
        console.log(`   Average Idle Funds: ${avgIdleFunds}`);
        console.log(`   Average Effective Points: ${avgEffectivePoints}`);
    }
    
    console.log("=".repeat(120));
}

// Test pagination functionality
async function testPagination(): Promise<void> {
    console.log("\n📄 Testing Pagination Functionality...");
    
    const pageSize = 5;
    let currentPage = 0;
    let hasMore = true;
    
    while (hasMore && currentPage < 3) { // Limit to 3 pages for testing
        console.log(`\n--- Page ${currentPage + 1} (start: ${currentPage * pageSize}) ---`);
        
        const playersResponse = await getPlayersList(currentPage * pageSize);
        
        if (!playersResponse.success || !playersResponse.data || playersResponse.data.length === 0) {
            console.log("No more players found");
            hasMore = false;
        } else {
            console.log(`Found ${playersResponse.data.length} players on page ${currentPage + 1}`);
            
            // Display first few player keys
            playersResponse.data.slice(0, 3).forEach((player, index) => {
                console.log(`  ${currentPage * pageSize + index + 1}. ${player.pkx}`);
            });
            
            if (playersResponse.data.length < pageSize) {
                hasMore = false;
            }
        }
        
        currentPage++;
    }
    
    console.log("✅ Pagination test completed");
}

// Performance test - measure API response times
async function performanceTest(): Promise<void> {
    console.log("\n⚡ Performance Testing...");
    
    const iterations = 3;
    const times: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        await getPlayersList(0);
        const endTime = Date.now();
        const duration = endTime - startTime;
        times.push(duration);
        console.log(`  Iteration ${i + 1}: ${duration}ms`);
    }
    
    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    console.log(`📈 Performance Results:`);
    console.log(`   Average: ${avgTime.toFixed(2)}ms`);
    console.log(`   Min: ${minTime}ms`);
    console.log(`   Max: ${maxTime}ms`);
}

// Main test function
async function runLeaderboardTest(): Promise<void> {
    console.log("🧪 Starting Leaderboard Test Suite\n");
    console.log("Testing endpoint: GET /data/players/:start");
    console.log("RPC endpoint: http://127.0.0.1:3000\n");
    
    try {
        // Test 1: Basic API connectivity
        console.log("🔌 Testing API Connectivity...");
        const basicTest = await getPlayersList(0);
        if (!basicTest.success) {
            throw new Error("Failed to connect to /data/players endpoint");
        }
        console.log("✅ API connectivity test passed");
        
        // Test 2: Performance testing
        await performanceTest();
        
        // Test 3: Pagination testing
        await testPagination();
        
        // Test 4: Build and display complete leaderboard
        console.log("\n🏗️  Building Complete Leaderboard...");
        const leaderboard = await buildLeaderboard(10); // Get top 10 players
        
        if (leaderboard.length > 0) {
            displayLeaderboard(leaderboard);
            
            // Test 5: Highlight top performers
            console.log("\n🌟 TOP PERFORMERS:");
            const topPlayers = leaderboard.slice(0, 3);
            topPlayers.forEach((player, index) => {
                const medal = ["🥇", "🥈", "🥉"][index];
                console.log(`${medal} Rank ${player.rank}: ${player.pkx.substring(0, 12)}... - ${player.effectivePoints} effective points`);
            });
        } else {
            console.log("⚠️  No players found for leaderboard");
        }
        
        console.log("\n✅ All leaderboard tests completed successfully!");
        
    } catch (error) {
        console.error("\n❌ Leaderboard test failed:", error);
        console.log("\nTroubleshooting:");
        console.log("1. Make sure the zkWasm server is running on localhost:3000");
        console.log("2. Verify the /data/players endpoint is available");
        console.log("3. Check that there are players in the system");
        console.log("4. Ensure the staking contract is properly deployed");
        process.exit(1);
    }
}

// Export for use in other modules
export {
    runLeaderboardTest,
    buildLeaderboard,
    getPlayersList,
    LeaderboardEntry,
    PlayersResponse
};

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runLeaderboardTest();
} 