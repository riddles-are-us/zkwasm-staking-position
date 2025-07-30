import { testPointsWithdrawal, bulkPointsWithdrawal } from './withdraw_points.js';

async function runPointsWithdrawalTests() {
    console.log("🚀 Starting Points Withdrawal Tests");
    
    try {
        // Test single points withdrawal
        console.log("\n=== Test 1: Single Points Withdrawal ===");
        await testPointsWithdrawal();
        
        // Test bulk points withdrawal
        console.log("\n=== Test 2: Bulk Points Withdrawal ===");
        const testAmounts = [1n, 2n, 5n]; // Test different amounts
        await bulkPointsWithdrawal(testAmounts);
        
        console.log("\n✅ All points withdrawal tests completed!");
        
    } catch (error) {
        console.error("❌ Points withdrawal tests failed:", error);
    }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runPointsWithdrawalTests().catch(console.error);
}

export { runPointsWithdrawalTests }; 