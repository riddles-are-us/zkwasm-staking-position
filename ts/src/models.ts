// Staking system models - focused on calculations without database dependency

// Global state interface
export interface GlobalState {
    counter: bigint;
    totalPlayers: bigint;
    totalFunds: bigint;
}


// Staking Player class for calculations
export class StakingPlayer {
    userId: bigint[];
    points: bigint;
    idleFunds: bigint;

    constructor(data: any) {
        this.userId = data.userId || [0n, 0n];
        this.points = data.points || 0n;
        this.idleFunds = data.idleFunds || 0n;
    }

    // Certificate system: points are static (no automatic accumulation)
    calculateEffectivePoints(_currentCounter: bigint): bigint {
        // No more automatic point accumulation - certificate system handles interest
        return this.points;
    }

    // Get player status summary
    getStatus(currentCounter: bigint): {
        points: bigint,
        effectivePoints: bigint,
        idleFunds: bigint
    } {
        return {
            points: this.points,
            effectivePoints: this.calculateEffectivePoints(currentCounter),
            idleFunds: this.idleFunds
        };
    }
}

// Certificate System Event Models (matching Rust event structs)

export class CertificatePurchaseEvent {
    userId: bigint[];
    certificateId: bigint;
    productTypeId: bigint;
    amount: bigint;
    txid: bigint;
    counter: bigint;

    constructor(data: any) {
        this.userId = data.userId || [0n, 0n];
        this.certificateId = data.certificateId || 0n;
        this.productTypeId = data.productTypeId || 0n;
        this.amount = data.amount || 0n;
        this.txid = data.txid || 0n;
        this.counter = data.counter || 0n;
    }
}

export class InterestClaimEvent {
    userId: bigint[];
    certificateId: bigint;
    amount: bigint;
    txid: bigint;
    counter: bigint;

    constructor(data: any) {
        this.userId = data.userId || [0n, 0n];
        this.certificateId = data.certificateId || 0n;
        this.amount = data.amount || 0n;
        this.txid = data.txid || 0n;
        this.counter = data.counter || 0n;
    }
}

export class PrincipalRedemptionEvent {
    userId: bigint[];
    certificateId: bigint;
    amount: bigint;
    txid: bigint;
    counter: bigint;

    constructor(data: any) {
        this.userId = data.userId || [0n, 0n];
        this.certificateId = data.certificateId || 0n;
        this.amount = data.amount || 0n;
        this.txid = data.txid || 0n;
        this.counter = data.counter || 0n;
    }
}

export class ProductTypeEvent {
    adminId: bigint[];
    productTypeId: bigint;
    durationTicks: bigint;
    apy: bigint;
    minAmount: bigint;
    isActive: boolean;
    counter: bigint;
    eventType: 'CREATED' | 'MODIFIED';

    constructor(data: any) {
        this.adminId = data.adminId || [0n, 0n];
        this.productTypeId = data.productTypeId || 0n;
        this.durationTicks = data.durationTicks || 0n;
        this.apy = data.apy || 0n;
        this.minAmount = data.minAmount || 0n;
        this.isActive = data.isActive || false;
        this.counter = data.counter || 0n;
        this.eventType = data.eventType || 'CREATED';
    }
}

export class WithdrawalEvent {
    userId: bigint[];
    amount: bigint;
    addressParts: bigint[];
    txid: bigint;
    counter: bigint;

    constructor(data: any) {
        this.userId = data.userId || [0n, 0n];
        this.amount = data.amount || 0n;
        this.addressParts = data.addressParts || [0n, 0n, 0n];
        this.txid = data.txid || 0n;
        this.counter = data.counter || 0n;
    }
}

export class DepositEvent {
    adminId: bigint[];
    userId: bigint[];
    amount: bigint;
    txid: bigint;
    counter: bigint;

    constructor(data: any) {
        this.adminId = data.adminId || [0n, 0n];
        this.userId = data.userId || [0n, 0n];
        this.amount = data.amount || 0n;
        this.txid = data.txid || 0n;
        this.counter = data.counter || 0n;
    }
}

export class PointsWithdrawalEvent {
    userId: bigint[];
    pointsAmount: bigint;
    addressParts: bigint[];
    txid: bigint;
    counter: bigint;

    constructor(data: any) {
        this.userId = data.userId || [0n, 0n];
        this.pointsAmount = data.pointsAmount || 0n;
        this.addressParts = data.addressParts || [0n, 0n, 0n];
        this.txid = data.txid || 0n;
        this.counter = data.counter || 0n;
    }
}

export class AdminWithdrawalEvent {
    adminId: bigint[];
    amount: bigint;
    txid: bigint;
    counter: bigint;

    constructor(data: any) {
        this.adminId = data.adminId || [0n, 0n];
        this.amount = data.amount || 0n;
        this.txid = data.txid || 0n;
        this.counter = data.counter || 0n;
    }
}

// Legacy Staking Event class (for backwards compatibility)
export class StakingEvent {
    userId: bigint[];
    amount: bigint;
    txid: bigint;
    counter: bigint;
    eventType: 'DEPOSIT' | 'WITHDRAW';

    constructor(data: any) {
        this.userId = data.userId || [0n, 0n];
        this.amount = data.amount || 0n;
        this.txid = data.txid || 0n;
        this.counter = data.counter || 0n;
        this.eventType = data.eventType || 'DEPOSIT';
    }
}

// Global Stats class
export class StakingStats {
    counter: bigint;
    totalPlayers: bigint;
    totalFunds: bigint;
    updatedAt: bigint;

    constructor(data: any) {
        this.counter = data.counter || 0n;
        this.totalPlayers = data.totalPlayers || 0n;
        this.totalFunds = data.totalFunds || 0n;
        this.updatedAt = data.updatedAt || 0n;
    }
}

// Utility functions
export function userIdToString(userId: bigint[]): string {
    return `${userId[0]}_${userId[1]}`;
}

export function stringToUserId(userIdStr: string): bigint[] {
    const parts = userIdStr.split('_');
    return [BigInt(parts[0] || 0), BigInt(parts[1] || 0)];
}

export function formatAmount(amount: bigint): string {
    return amount.toString();
}

export function formatPoints(points: bigint): string {
    return points.toString();
}

export function formatCounter(counter: bigint): string {
    return counter.toString();
}

// Certificate system models

export enum CertificateStatus {
    Active = "Active",
    Matured = "Matured", 
    Redeemed = "Redeemed"
}

export interface ProductType {
    id: bigint;
    durationTicks: bigint;    // Duration in server ticks (5 seconds per tick)
    apy: bigint;              // APY in basis points (1000 = 10%)
    minAmount: bigint;        // Minimum investment in USDT
    isActive: boolean;
}

export interface Certificate {
    id: bigint;
    owner: bigint[];          // [pid1, pid2]
    productTypeId: bigint;
    principal: bigint;        // Principal amount in USDT
    purchaseTime: bigint;     // Counter when purchased
    maturityTime: bigint;     // Counter when it matures
    lockedApy: bigint;        // APY locked at purchase (basis points)
    totalInterestClaimed: bigint; // Total interest claimed so far
    status: CertificateStatus;
}

export interface CertificateInfo {
    certificate: Certificate;
    availableInterest: bigint;  // Interest available for withdrawal
    totalInterest: bigint;      // Total interest generated since purchase
    currentTime: bigint;        // Current counter
}

export class ProductTypeManager {
    static fromData(data: bigint[]): ProductType {
        return {
            id: data[0],
            durationTicks: data[1],
            apy: data[2],
            minAmount: data[3],
            isActive: data[4] !== 0n
        };
    }

    static toData(productType: ProductType): bigint[] {
        return [
            productType.id,
            productType.durationTicks,
            productType.apy,
            productType.minAmount,
            productType.isActive ? 1n : 0n
        ];
    }

    static calculateMaturityTime(purchaseTime: bigint, durationTicks: bigint): bigint {
        // Duration is already in ticks
        return purchaseTime + durationTicks;
    }

    static formatApy(apyBasisPoints: bigint): string {
        // Convert basis points to percentage string
        // BASIS_POINTS_DIVISOR = 10000 (10000 basis points = 100%)
        const percentage = Number(apyBasisPoints) / 10000;
        return `${(percentage * 100).toFixed(2)}%`;
    }

    static formatDuration(durationTicks: bigint): string {
        // Convert ticks to days (1 tick = 5 seconds, 17280 ticks = 1 day)
        const TICKS_PER_DAY = 17280n;
        const days = Number(durationTicks / TICKS_PER_DAY);
        
        if (days < 30) {
            return `${days} days`;
        } else if (days < 365) {
            const months = Math.floor(days / 30);
            return `${months} month${months > 1 ? 's' : ''}`;
        } else {
            const years = Math.floor(days / 365);
            return `${years} year${years > 1 ? 's' : ''}`;
        }
    }

    static formatDurationTicks(durationTicks: bigint): string {
        // Convert ticks to days (1 tick = 5 seconds, 17280 ticks = 1 day)
        const TICKS_PER_DAY = 17280n;
        const days = Number(durationTicks / TICKS_PER_DAY);
        
        if (days < 30) {
            return `${days} days`;
        } else if (days < 365) {
            const months = Math.floor(days / 30);
            return `${months} month${months > 1 ? 's' : ''}`;
        } else {
            const years = Math.floor(days / 365);
            return `${years} year${years > 1 ? 's' : ''}`;
        }
    }
}

export class CertificateManager {
    static fromData(data: bigint[]): Certificate {
        return {
            id: data[0],
            owner: [data[1], data[2]],
            productTypeId: data[3],
            principal: data[4],
            purchaseTime: data[5],
            maturityTime: data[6],
            lockedApy: data[7],
            totalInterestClaimed: data[8],
            status: CertificateManager.statusFromU64(data[9])
        };
    }

    static toData(cert: Certificate): bigint[] {
        return [
            cert.id,
            cert.owner[0],
            cert.owner[1],
            cert.productTypeId,
            cert.principal,
            cert.purchaseTime,
            cert.maturityTime,
            cert.lockedApy,
            cert.totalInterestClaimed,
            CertificateManager.statusToU64(cert.status)
        ];
    }

    static statusFromU64(value: bigint): CertificateStatus {
        switch (Number(value)) {
            case 0: return CertificateStatus.Active;
            case 1: return CertificateStatus.Matured;
            case 2: return CertificateStatus.Redeemed;
            default: return CertificateStatus.Active;
        }
    }

    static statusToU64(status: CertificateStatus): bigint {
        switch (status) {
            case CertificateStatus.Active: return 0n;
            case CertificateStatus.Matured: return 1n;
            case CertificateStatus.Redeemed: return 2n;
        }
    }

    static calculateAvailableInterest(cert: Certificate, currentTime: bigint): bigint {
        // Calculate total interest from purchase time to current time
        const totalInterest = this.calculateTotalInterest(cert, currentTime);
        
        // Available interest = total earned - already claimed
        const availableInterest = totalInterest - cert.totalInterestClaimed;
        return availableInterest > 0n ? availableInterest : 0n;
    }

    static calculateTotalInterest(cert: Certificate, currentTime: bigint): bigint {
        if (currentTime <= cert.purchaseTime) {
            return 0n;
        }

        const timeElapsed = currentTime - cert.purchaseTime;
        
        // Convert to Numbers for precise calculation (avoid BigInt precision loss)
        const principal = Number(cert.principal);
        const apy = Number(cert.lockedApy);
        const timeElapsedNum = Number(timeElapsed);
        
        // Use consistent time calculation with Rust backend
        const SECONDS_PER_TICK = 5;
        const timeElapsedSeconds = timeElapsedNum * SECONDS_PER_TICK;
        
        // Simple interest calculation with floating point precision
        const SECONDS_PER_YEAR = 365 * 24 * 60 * 60; // 31,536,000
        const BASIS_POINTS_DIVISOR = 10000;
        
        // Calculate: (principal * apy * time_elapsed_seconds) / (basis_points * seconds_per_year)
        const interestFloat = (principal * apy * timeElapsedSeconds) / (BASIS_POINTS_DIVISOR * SECONDS_PER_YEAR);
        
        // Round and convert back to BigInt
        return BigInt(Math.floor(interestFloat));
    }

    static calculateTotalSimpleInterest(cert: Certificate, currentTime: bigint): bigint {
        if (currentTime <= cert.purchaseTime) {
            return 0n;
        }

        const totalTime = currentTime - cert.purchaseTime;
        
        // Use consistent time calculation with Rust backend
        const SECONDS_PER_TICK = 5n;
        const totalTimeSeconds = totalTime * SECONDS_PER_TICK;
        
        // Simple interest: (principal * APY * total_time_seconds) / (BASIS_POINTS_DIVISOR * SECONDS_PER_YEAR)
        const SECONDS_PER_YEAR = 365n * 24n * 60n * 60n; // 31,536,000
        const BASIS_POINTS_DIVISOR = 10000n;
        
        // Use BigInt arithmetic for precision
        const numerator = cert.principal * cert.lockedApy * totalTimeSeconds;
        const denominator = BASIS_POINTS_DIVISOR * SECONDS_PER_YEAR;
        
        return numerator / denominator;
    }

    static isMatured(cert: Certificate, currentTime: bigint): boolean {
        return currentTime >= cert.maturityTime;
    }

    static updateStatus(cert: Certificate, currentTime: bigint): Certificate {
        const updatedCert = { ...cert };
        
        if (cert.status === CertificateStatus.Active && CertificateManager.isMatured(cert, currentTime)) {
            updatedCert.status = CertificateStatus.Matured;
        }
        
        return updatedCert;
    }

    static getCertificateInfo(cert: Certificate, currentTime: bigint): CertificateInfo {
        const updatedCert = CertificateManager.updateStatus(cert, currentTime);
        
        return {
            certificate: updatedCert,
            availableInterest: CertificateManager.calculateAvailableInterest(updatedCert, currentTime),
            totalInterest: CertificateManager.calculateTotalSimpleInterest(updatedCert, currentTime),
            currentTime
        };
    }

    static formatPrincipal(principal: bigint): string {
        return `${principal.toLocaleString()} USDT`;
    }

    static formatInterest(interest: bigint): string {
        return `${interest.toLocaleString()} USDT`;
    }
}

// Certificate system calculation utilities
export class CertificateCalculator {
    static readonly SECONDS_PER_TICK = 5n;
    static readonly COUNTERS_PER_DAY = (24n * 60n * 60n) / CertificateCalculator.SECONDS_PER_TICK; // 17280
    static readonly COUNTERS_PER_YEAR = 365n * CertificateCalculator.COUNTERS_PER_DAY;
    static readonly SECONDS_PER_YEAR = 365n * 24n * 60n * 60n; // 31,536,000
    static readonly BASIS_POINTS_DIVISOR = 10000n;

    // Calculate expected annual interest for a certificate
    static calculateAnnualInterest(principal: bigint, apyBasisPoints: bigint): bigint {
        // Convert to Numbers for precise calculation (avoid BigInt precision loss)
        const principalNum = Number(principal);
        const apyNum = Number(apyBasisPoints);
        
        const annualInterestFloat = (principalNum * apyNum) / Number(CertificateCalculator.BASIS_POINTS_DIVISOR);
        
        // Round and convert back to BigInt
        return BigInt(Math.floor(annualInterestFloat));
    }

    // Calculate daily interest rate in counters
    static calculateDailyInterest(principal: bigint, apyBasisPoints: bigint): bigint {
        const annualInterest = CertificateCalculator.calculateAnnualInterest(principal, apyBasisPoints);
        
        // Convert to Number for precise division
        const annualInterestNum = Number(annualInterest);
        const dailyInterestFloat = annualInterestNum / 365;
        
        // Round and convert back to BigInt
        return BigInt(Math.floor(dailyInterestFloat));
    }

    // Calculate interest for specific time period
    static calculateInterestForPeriod(principal: bigint, apyBasisPoints: bigint, counters: bigint): bigint {
        // Convert to Numbers for precise calculation
        const principalNum = Number(principal);
        const apyNum = Number(apyBasisPoints);
        const countersNum = Number(counters);
        
        const timeInSeconds = countersNum * Number(CertificateCalculator.SECONDS_PER_TICK);
        
        // Use consistent formula with Rust backend (floating point precision)
        const interestFloat = (principalNum * apyNum * timeInSeconds) / 
                             (Number(CertificateCalculator.BASIS_POINTS_DIVISOR) * Number(CertificateCalculator.SECONDS_PER_YEAR));
        
        // Round and convert back to BigInt
        return BigInt(Math.floor(interestFloat));
    }

    // Convert days to counters
    static daysToCounters(days: bigint): bigint {
        return days * CertificateCalculator.COUNTERS_PER_DAY;
    }

    // Convert counters to days
    static countersToDays(counters: bigint): bigint {
        return counters / CertificateCalculator.COUNTERS_PER_DAY;
    }

    // Format APY for display
    static formatApy(apyBasisPoints: bigint): string {
        // BASIS_POINTS_DIVISOR = 10000 (10000 basis points = 100%)
        const percentage = Number(apyBasisPoints) / 10000;
        return `${(percentage * 100).toFixed(2)}%`;
    }
} 