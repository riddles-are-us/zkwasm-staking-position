// Staking system models - focused on calculations without database dependency

// Global state interface
export interface GlobalState {
    counter: bigint;
    totalPlayers: bigint;
    totalStaked: bigint;
}

// Function to get current counter from zkwasm global state
export async function getCurrentCounter(): Promise<bigint> {
    try {
        // TODO: Replace with actual zkwasm state query
        // This should call something like: await rpc.query_state() and parse the counter
        // For now, return a mock value
        return 1000n;
    } catch (error) {
        console.error("Error getting current counter:", error);
        return 0n;
    }
}

// Staking Player class for calculations
export class StakingPlayer {
    userId: bigint[];
    points: bigint;
    lastStakeTime: bigint;
    totalStaked: bigint;

    constructor(data: any) {
        this.userId = data.userId || [0n, 0n];
        this.points = data.points || 0n;
        this.lastStakeTime = data.lastStakeTime || 0n;
        this.totalStaked = data.totalStaked || 0n;
    }

    // Calculate effective points = points + total_staked * delta_counter
    calculateEffectivePoints(currentCounter: bigint): bigint {
        if (this.lastStakeTime === 0n || currentCounter <= this.lastStakeTime) {
            return this.points;
        }
        
        const deltaTime = currentCounter - this.lastStakeTime;
        const interestPoints = this.totalStaked * deltaTime;
        return this.points + interestPoints;
    }

    // Get player status summary
    getStatus(currentCounter: bigint): {
        points: bigint,
        totalStaked: bigint,
        lastStakeTime: bigint,
        effectivePoints: bigint
    } {
        return {
            points: this.points,
            totalStaked: this.totalStaked,
            lastStakeTime: this.lastStakeTime,
            effectivePoints: this.calculateEffectivePoints(currentCounter)
        };
    }
}

// Staking Event class
export class StakingEvent {
    userId: bigint[];
    amount: bigint;
    txid: bigint;
    timestamp: bigint; // This is actually counter, not system timestamp
    eventType: 'DEPOSIT' | 'WITHDRAW';

    constructor(data: any) {
        this.userId = data.userId || [0n, 0n];
        this.amount = data.amount || 0n;
        this.txid = data.txid || 0n;
        this.timestamp = data.timestamp || 0n; // Counter value
        this.eventType = data.eventType || 'DEPOSIT';
    }
}

// Global Stats class
export class StakingStats {
    counter: bigint;
    totalPlayers: bigint;
    totalStaked: bigint;
    updatedAt: bigint;

    constructor(data: any) {
        this.counter = data.counter || 0n;
        this.totalPlayers = data.totalPlayers || 0n;
        this.totalStaked = data.totalStaked || 0n;
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

export function formatStakeAmount(amount: bigint): string {
    return amount.toString();
}

export function formatPoints(points: bigint): string {
    return points.toString();
}

export function formatCounter(counter: bigint): string {
    return counter.toString();
} 