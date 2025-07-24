# zkWasm Staking Platform

A comprehensive zkWasm-based staking platform where users can stake ZKWASM tokens to earn interest-based points over time. The platform implements a time-based interest calculation system where effective points grow continuously based on staked amounts.

## 🚀 Features

### Core Staking Functions
- **Token Staking**: Users can stake ZKWASM tokens to earn points over time
- **Interest Calculation**: Points increase based on staked amount × time elapsed
- **Dynamic Withdrawals**: Users can withdraw staked tokens at any time
- **Real-time Points**: Effective points calculated dynamically based on current time
- **Admin Deposits**: Administrators can deposit tokens on behalf of users

### Interest System
- **Time-based Growth**: `effective_points = base_points + (staked_amount × time_delta)`
- **Continuous Accrual**: Interest accumulates every counter tick
- **Automatic Updates**: Points automatically updated on stake/unstake operations
- **No Minimum Stake**: Users can stake any amount of tokens

## 🏗️ Technical Architecture

### Rust Backend (`src/`)
```
├── lib.rs                 # Application entry point and zkWasm API
├── config.rs              # Configuration constants and staking parameters
├── error.rs               # Error code definitions and handling
├── command.rs             # Transaction command processing
├── player.rs              # User data structures and staking operations
├── math_safe.rs           # Safe mathematical operations
├── settlement.rs          # Withdrawal settlement system
└── state.rs               # Global state management
```

### TypeScript Backend (`ts/src/`)
```
├── service.ts             # Main service with REST API endpoints
├── models.ts              # Data models and calculation utilities
├── api.ts                 # Client API and staking calculators
└── test.ts                # Comprehensive staking system tests
```

## 📊 Staking Interest Algorithm

### Interest Calculation Formula
```rust
effective_points = base_points + (total_staked × (current_counter - last_stake_time))
```

### Example Calculation
```typescript
// User has 1,000,000 base points
// User staked 50,000 tokens at counter 100
// Current counter is 200
// Time delta = 200 - 100 = 100

// Interest = 50,000 × 100 = 5,000,000 points
// Effective points = 1,000,000 + 5,000,000 = 6,000,000 points
```

### Staking Operations
1. **Deposit**: Admin deposits tokens for user, updates points with accrued interest
2. **Withdraw**: User withdraws tokens, points updated with accrued interest first
3. **Query**: Real-time calculation of effective points without state modification

## 🎮 Transaction Commands

| Command ID | Command | Parameters | Permission | Description |
|------------|---------|------------|------------|-------------|
| 1 | INSTALL_PLAYER | - | Any | Register new user |
| 2 | WITHDRAW | amount, address | User | Withdraw staked tokens to external address |
| 3 | DEPOSIT | target_pid1, target_pid2, amount | Admin | Deposit tokens for user |

## 💻 Data Structures

### Player Data Structure
```rust
pub struct PlayerData {
    pub points: u64,           // User points/score
    pub last_stake_time: u64,  // Last stake timestamp
    pub total_staked: u64,     // Total staked amount
}
```

### Global State Structure
```rust
pub struct GlobalState {
    pub counter: u64,          // Global time counter
    pub total_players: u64,    // Total number of players
    pub total_staked: u64,     // Total staked amount across all users
    pub txsize: u64,           // Transaction count
    pub txcounter: u64,        // Transaction counter
}
```

## 🔧 TypeScript API Usage

### Staking Operations
```typescript
import { StakingTestPlayer, StakingAdmin } from './test.js';

// Create admin instance
const admin = new StakingAdmin(adminKey, rpc);

// Create user instance
const player = new StakingTestPlayer(userKey, rpc);

// Admin deposits tokens for user
const userPid = player.getPlayerId();
await admin.depositForUser(userPid, 50000n); // Deposit 50,000 tokens

// User withdraws tokens
await player.withdraw(10000n, "0x1234567890123456789012345678901234567890");
```

### Points Calculation
```typescript
import { StakingCalculator } from './api.js';

// Calculate effective points
const effectivePoints = StakingCalculator.calculateEffectivePoints(
    basePoints,        // Current points
    totalStaked,       // Total staked amount
    lastStakeTime,     // Last stake timestamp
    currentCounter     // Current time counter
);

// Calculate interest only
const interest = StakingCalculator.calculateInterest(
    stakeAmount,       // Staked amount
    timeDelta         // Time difference
);
```

### State Queries
```typescript
// Query user state
const stateResponse = await rpc.queryState(userKey);
const stateData = JSON.parse(stateResponse.data);

// Extract global state
const globalState = {
    counter: stateData.state.counter,
    totalPlayers: stateData.state.total_players,
    totalStaked: stateData.state.total_staked
};

// Extract player state
const playerState = {
    points: stateData.player.data.points,
    totalStaked: stateData.player.data.total_staked,
    lastStakeTime: stateData.player.data.last_stake_time
};
```

## 🚦 Staking Lifecycle

### Phase 1: User Registration
1. User installs player account
2. Initial state: 0 points, 0 staked, 0 last_stake_time

### Phase 2: Token Deposit
1. Admin deposits tokens for user
2. Points updated with accrued interest (if any)
3. Stake amount added to total_staked
4. last_stake_time updated to current counter

### Phase 3: Interest Accrual
1. Interest accumulates automatically over time
2. Effective points = base_points + (staked_amount × time_elapsed)
3. No state modification until next operation

### Phase 4: Token Withdrawal
1. User initiates withdrawal
2. Points updated with accrued interest
3. Stake amount reduced
4. last_stake_time updated to current counter
5. Tokens transferred to user's external address

## 🛡️ Security Features

### Mathematical Safety
- **Safe Arithmetic**: All operations use checked arithmetic to prevent overflow/underflow
- **Interest Protection**: Interest calculations verified for mathematical correctness
- **Balance Verification**: Sufficient staked balance checked before withdrawal

### Access Control
- **Admin Functions**: Token deposits restricted to admin keys
- **User Functions**: Withdrawals restricted to token owners
- **State Isolation**: Each user's state managed independently

### Staking Protection
- **Minimum Validation**: No minimum stake requirements (removed by design)
- **Sufficient Balance**: Withdrawal amount validated against staked balance
- **Time Consistency**: Timestamps properly managed to prevent time manipulation

## 🔍 Testing

The platform includes comprehensive tests:

### Rust Tests
```bash
cargo test
```
- Mathematical safety tests
- Interest calculation scenarios
- Security boundary tests
- State consistency tests

### TypeScript Integration Tests
```bash
cd ts && npm test
```
- Full staking lifecycle testing
- Interest calculation verification
- RPC interaction testing
- State query validation

## 📈 Example Usage

### Complete Staking Flow
```typescript
// 1. Install players
await admin.installPlayer();
await player1.installPlayer();
await player2.installPlayer();

// 2. Admin deposits tokens for users
const player1Id = player1.getPlayerId();
const player2Id = player2.getPlayerId();

await admin.depositForUser(player1Id, 100000n); // 100K tokens
await admin.depositForUser(player2Id, 50000n);  // 50K tokens

// 3. Wait for time to pass (interest accrues automatically)
// After 100 counter ticks:
// Player1 interest: 100,000 × 100 = 10,000,000 points
// Player2 interest: 50,000 × 100 = 5,000,000 points

// 4. Users can withdraw tokens
await player1.withdraw(25000n, userAddress); // Withdraw 25K tokens
await player2.withdraw(10000n, userAddress); // Withdraw 10K tokens

// 5. Check effective points (calculated dynamically)
const player1State = await rpc.queryState(player1.processingKey);
const effectivePoints = StakingCalculator.calculateEffectivePoints(
    player1State.player.data.points,
    player1State.player.data.total_staked,
    player1State.player.data.last_stake_time,
    player1State.state.counter
);
```

## 📊 Interest Calculation Examples

### Scenario 1: Single Deposit
```
Initial: 0 points, 0 staked, counter = 0
Deposit: 50,000 tokens at counter = 100
Query at counter = 200:
- Time delta = 200 - 100 = 100
- Interest = 50,000 × 100 = 5,000,000
- Effective points = 0 + 5,000,000 = 5,000,000
```

### Scenario 2: Multiple Operations
```
Initial: 0 points, 0 staked, counter = 0
Deposit: 30,000 tokens at counter = 50
- Points updated: 0 + 0 = 0 (no previous stake)
- New state: 0 points, 30,000 staked, last_time = 50

Deposit: 20,000 tokens at counter = 150
- Interest: 30,000 × (150 - 50) = 3,000,000
- Points updated: 0 + 3,000,000 = 3,000,000
- New state: 3,000,000 points, 50,000 staked, last_time = 150

Query at counter = 250:
- Time delta = 250 - 150 = 100
- Interest = 50,000 × 100 = 5,000,000
- Effective points = 3,000,000 + 5,000,000 = 8,000,000
```
## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

# zkwasm-staking
