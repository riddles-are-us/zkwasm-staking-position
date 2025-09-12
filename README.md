# zkWasm Certificate-Based Staking Platform

A comprehensive zkWasm-based certificate staking platform where users can purchase time-deposit certificates to earn interest over time. The platform implements a certificate-based system with fixed-term deposits, locked APY rates, and precise interest calculations.

## 🚀 Features

### Core Certificate Functions
- **Certificate Purchase**: Users can purchase fixed-term deposit certificates
- **Interest Claiming**: Claim accumulated interest to idle funds at any time
- **Principal Redemption**: Redeem principal after certificate maturity
- **Product Management**: Admin-configurable certificate products with different terms
- **Fund Management**: Separate tracking of idle funds and locked certificate funds

### Certificate System
- **Fixed-Term Deposits**: Certificates with predetermined durations (in ticks: 1 tick = 5 seconds)
- **Locked APY Rates**: Interest rates locked at purchase time
- **Cumulative Interest**: Precise interest calculation without precision loss
- **Flexible Claims**: Claim interest anytime during certificate term
- **Maturity Redemption**: Redeem principal only after maturity date

## 🏗️ Technical Architecture

### Rust Backend (`src/`)
```
├── lib.rs                 # Application entry point and zkWasm API
├── config.rs              # Configuration constants and fund calculations
├── error.rs               # Error code definitions and handling
├── command.rs             # Transaction command processing
├── player.rs              # User data structures and fund operations
├── certificate.rs         # Certificate and ProductType structures
├── cert_manager.rs        # Certificate and product management
├── math_safe.rs           # Safe mathematical operations
├── settlement.rs          # Withdrawal settlement system
├── state.rs               # Global state management
└── event.rs               # Event emission for indexing
```

### TypeScript Backend (`ts/src/`)
```
├── service.ts             # Main service with REST API endpoints
├── models.ts              # Data models and calculation utilities
├── api.ts                 # Client API and certificate calculators
└── test.ts                # Comprehensive certificate system tests
```

## 📊 Certificate Interest Algorithm

### Interest Calculation Formula
```rust
// Simple interest calculation (no compounding)
// Correct order: multiply all numerator terms first, then divide to avoid precision loss
interest = (principal × apy × time_elapsed_seconds) / (10000 × seconds_per_year)

// Available interest = total_earned_interest - total_claimed_interest
available_interest = calculate_total_interest(current_time) - total_interest_claimed
```

### Example Calculation
```typescript
// Certificate: 100,000 USDT, 12% APY (1200 basis points), 30 days
// Time elapsed: 30 days = 2,592,000 seconds
// Annual seconds: 31,536,000

// Daily interest rate = 1200 / 10000 / 365 ≈ 0.000329
// Interest = 100,000 × (1200/10000) × (2,592,000/31,536,000)
//          = 100,000 × 0.12 × 0.0822 = 986.4 USDT
```

## 🎮 Transaction Commands

### User Commands
| Command ID | Command | Parameters | Description |
|------------|---------|------------|-------------|
| 1 | INSTALL_PLAYER | - | Register new user |
| 2 | WITHDRAW | amount, address | Withdraw idle funds to external address |
| 5 | WITHDRAW_POINTS | amount, address | Withdraw points (static, no interest) |
| 10 | PURCHASE_CERTIFICATE | product_type_id, amount | Purchase certificate with idle funds |
| 11 | CLAIM_INTEREST | certificate_id | Claim all available interest to idle funds |
| 12 | REDEEM_PRINCIPAL | certificate_id | Redeem principal after maturity |

### Admin Commands
| Command ID | Command | Parameters | Description |
|------------|---------|------------|-------------|
| 3 | DEPOSIT | target_pid1, target_pid2, amount | Deposit USDT to user's idle funds |
| 6 | CREATE_PRODUCT_TYPE | duration_ticks, apy, min_amount, is_active | Create new certificate product |
| 7 | MODIFY_PRODUCT_TYPE | product_id, apy, duration_ticks, min_amount, is_active | Modify existing product |
| 13 | ADMIN_WITHDRAW_TO_MULTISIG | amount | Withdraw from available funds to multisig |
| 14 | SET_RESERVE_RATIO | reserve_ratio_bp | Set reserve ratio for admin withdrawals |

## 💻 Data Structures

### Certificate Structure
```rust
pub struct Certificate {
    pub id: u64,                    // Certificate ID
    pub owner: [u64; 2],           // Owner user ID
    pub product_type_id: u64,       // Associated product type ID
    pub principal: u64,             // Principal amount in USDT
    pub purchase_time: u64,         // Purchase time (counter)
    pub maturity_time: u64,         // Maturity time (counter)
    pub locked_apy: u64,           // Locked APY at purchase (basis points)
    pub total_interest_claimed: u64, // Total interest claimed so far
    pub status: CertificateStatus,  // Certificate status
}
```

### ProductType Structure
```rust
pub struct ProductType {
    pub id: u64,                    // Product type ID
    pub duration_ticks: u64,        // Duration in ticks (1 tick = 5 seconds)
    pub apy: u64,                   // Annual percentage yield (basis points)
    pub min_amount: u64,            // Minimum investment amount
    pub is_active: bool,            // Whether open for purchase
}
```

### Player Data Structure
```rust
pub struct PlayerData {
    pub points: u64,           // Static points (no interest growth)
    pub idle_funds: u64,       // Available USDT funds
}
```

## 🔧 TypeScript API Usage

### Certificate Operations
```typescript
import { CertificateTestPlayer, CertificateAdmin } from './test.js';

// Create admin and user instances
const admin = new CertificateAdmin(adminKey, rpc);
const player = new CertificateTestPlayer(userKey, rpc);

// Admin creates a certificate product
await admin.createProductType(
    518400n,  // 30 days duration (30 * 17280 ticks)
    1200n,    // 12% APY (1200 basis points)
    1000n,    // 1000 USDT minimum
    true      // Active for purchase
);

// Admin deposits USDT for user
const userPid = player.getPlayerId();
await admin.depositForUser(userPid, 50000n); // Deposit 50,000 USDT

// User purchases certificate
await player.purchaseCertificate(1n, 10000n); // Product ID 1, 10,000 USDT

// User claims interest (all available)
await player.claimInterest(1n); // Certificate ID 1

// User redeems principal after maturity
await player.redeemPrincipal(1n); // Certificate ID 1

// User withdraws idle funds
await player.withdraw(5000n, "0x1234567890123456789012345678901234567890");
```

### Admin Fund Management
```typescript
// Set reserve ratio (10% = 1000 basis points)
await admin.setReserveRatio(1000n);

// Withdraw to multisig (respects reserve ratio)
await admin.withdrawToMultisig(100000n);

// Modify existing product
await admin.modifyProductType(
    1n,         // Product ID
    1500n,      // New 15% APY
    1036800n,   // New 60 days duration (60 * 17280 ticks)
    2000n,      // New 2000 USDT minimum
    false       // Deactivate for new purchases
);
```

## 🚦 Certificate Lifecycle

### Phase 1: Product Creation
1. Admin creates certificate products with specific terms
2. Each product has: duration, APY, minimum amount, active status
3. Product ID 0 is reserved for admin recharge operations

### Phase 2: User Fund Deposit
1. Admin deposits USDT to user's idle funds
2. User can check available idle funds balance
3. Funds are immediately available for certificate purchase or withdrawal

### Phase 3: Certificate Purchase
1. User selects active product type
2. System validates minimum amount and user balance
3. Certificate created with locked APY and maturity date
4. Funds transferred from idle funds to certificate (locked)

### Phase 4: Interest Accumulation
1. Interest accumulates continuously based on simple interest formula
2. Available interest = total earned - total claimed
3. Cumulative calculation prevents precision loss

### Phase 5: Interest Claims
1. User can claim available interest anytime
2. Interest transferred to idle funds
3. Principal remains locked until maturity

### Phase 6: Principal Redemption
1. After maturity date, user can redeem principal
2. Principal transferred back to idle funds
3. Certificate status changed to "Redeemed"

### Phase 7: Fund Withdrawal
1. User can withdraw idle funds to external address
2. Separate from certificate operations
3. No time restrictions on idle fund withdrawals

## 🛡️ Security Features

### Mathematical Safety
- **Overflow Protection**: All operations use checked arithmetic
- **Precision Preservation**: Cumulative interest calculation prevents precision loss
- **Interest Integrity**: Interest calculations mathematically verified

### Access Control
- **Admin Functions**: Product management and deposits restricted to admin
- **User Functions**: Certificate operations restricted to owners
- **Certificate Ownership**: Strict validation of certificate ownership

### Fund Protection
- **Reserve Ratio**: Admin withdrawals respect configurable reserve ratios
- **Available Funds**: Complex calculation ensures user fund protection
- **Separate Tracking**: Clear separation between user funds and system funds

### Certificate Protection
- **Maturity Enforcement**: Principal redemption only after maturity
- **Status Validation**: Proper certificate status transitions
- **Ownership Verification**: Certificate operations validated against ownership

## 🔍 Testing

The platform includes comprehensive tests covering 33 test cases:

### Rust Tests (33 tests)
```bash
cargo test
```
- Certificate interest calculation and precision tests
- Product type validation and management tests
- Mathematical safety and overflow protection tests
- Certificate lifecycle and status transition tests
- Fund tracking and calculation tests

### Test Categories
- **`certificate.rs`**: 11 tests - Core certificate logic and precision fixes
- **`cert_manager.rs`**: 7 tests - Certificate and product management  
- **`math_safe.rs`**: 9 tests - Mathematical safety operations
- **`player.rs`**: 6 tests - User data and fund operations

## 📈 Certificate Examples

### Example 1: 30-Day Certificate
```
Product: 518400 ticks (30 days), 12% APY, 1000 USDT minimum
Purchase: 10,000 USDT at time 0
After 259200 ticks (15 days): Available interest ≈ 49.32 USDT
After 518400 ticks (30 days): Total interest ≈ 98.63 USDT
Maturity: Can redeem 10,000 USDT principal
```

### Example 2: 1-Year Certificate  
```
Product: 6307200 ticks (365 days), 15% APY, 5000 USDT minimum
Purchase: 50,000 USDT at time 0
After 3153600 ticks (6 months): Available interest ≈ 3,750 USDT
After 6307200 ticks (1 year): Total interest = 7,500 USDT
Maturity: Can redeem 50,000 USDT principal
```

### Example 3: Multiple Certificates
```
User purchases:
- Certificate A: 20,000 USDT, 10% APY, 3110400 ticks (180 days)
- Certificate B: 30,000 USDT, 12% APY, 1555200 ticks (90 days)

After 1555200 ticks (90 days):
- Certificate A: ~986 USDT interest available
- Certificate B: ~887 USDT interest available + principal redeemable

User can claim interests separately and redeem Certificate B
Certificate A continues until 180-day maturity
```

## 💰 Fund Flow Architecture

### User Fund Types
- **Idle Funds**: Immediately available for withdrawal or certificate purchase
- **Certificate Principal**: Locked until certificate maturity
- **Accrued Interest**: Claimable anytime during certificate term

### Admin Fund Management
- **Total Funds**: All user deposits and certificate funds
- **Available for Admin**: Calculated with reserve ratio protection
- **Recharge Mechanism**: Special Product ID 0 for admin funding
- **Reserve Ratio**: Configurable protection for user funds

### Interest Payment Model
- **Interest Source**: Generated from total fund pool
- **Interest Rate**: Fixed at certificate purchase time
- **Payment Method**: On-demand claims to idle funds
- **No External Funding**: Interest paid from internal fund management

### Fund Flow Impact by Operation

| 操作 | total_funds | total_recharge | cumulative_admin | 用户idle_funds | 证书本金 |
|------|-------------|----------------|------------------|----------------|----------|
| 存款 | +amount | 0 | 0 | +amount | 0 |
| 证书购买(普通) | 0 | 0 | 0 | -amount | +amount |
| 证书购买(回充) | -amount | +amount | 0 | -amount | +amount |
| 利息索取 | 0 | 0 | 0 | +interest | 0 |
| 本金赎回 | 0 | 0 | 0 | +principal | -principal |
| 用户提现 | -amount | 0 | 0 | -amount | 0 |
| 管理员提现 | 0 | 0 | +amount | 0 | 0 |

**Fund Conservation Formula:**
```
系统实际资金 = Σ(所有用户idle_funds) + Σ(所有证书本金)
统计资金总额 = total_funds + total_recharge_amount - cumulative_admin_withdrawals
```

## 🔧 Configuration Constants

### Certificate Limits
```rust
pub const MIN_CERTIFICATE_AMOUNT: u64 = 10; // 10 USDT minimum
pub const MAX_CERTIFICATE_AMOUNT: u64 = 1_000_000_000; // 1B USDT max
pub const MAX_APY_BASIS_POINTS: u64 = 50_000; // 500% maximum APY
pub const MAX_CERTIFICATE_DURATION_TICKS: u64 = 63072000; // 10 years max (3650 * 17280)
```

### Time System (Tick-Based)
```rust
pub const SECONDS_PER_TICK: u64 = 5; // 5 seconds per tick
pub const TICKS_PER_DAY: u64 = 17280; // 24 * 60 * 60 / 5 = 17280 ticks/day
```

**Duration Conversion Examples:**
- 1 day = 17,280 ticks
- 1 week = 120,960 ticks  
- 1 month (30 days) = 518,400 ticks
- 1 year (365 days) = 6,307,200 ticks
- Maximum duration (10 years) = 63,072,000 ticks

### Interest Calculation
```rust
pub const BASIS_POINTS_DIVISOR: u64 = 10000; // 10000 = 100% (10000 basis points)
pub const SECONDS_PER_YEAR: u64 = 31536000; // 365 * 24 * 60 * 60
```