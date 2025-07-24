// Simplified API focused on counter-based calculations
export class StakingCalculator {
    // Calculate effective points for a player at given counter
    static calculateEffectivePoints(
        points: bigint,
        totalStaked: bigint,
        lastStakeTime: bigint,
        currentCounter: bigint
    ): bigint {
        if (lastStakeTime === 0n || currentCounter <= lastStakeTime) {
            return points;
        }
        
        const deltaTime = currentCounter - lastStakeTime;
        const interestPoints = totalStaked * deltaTime;
        return points + interestPoints;
    }

    // Calculate interest points for given parameters
    static calculateInterest(stakeAmount: bigint, timeDelta: bigint): bigint {
        return stakeAmount * timeDelta;
        }

    // Format counter for display
    static formatCounter(counter: bigint): string {
        return counter.toString();
    }

    // Format stake amount for display
    static formatStakeAmount(amount: bigint): string {
        return amount.toString();
    }

    // Format points for display
    static formatPoints(points: bigint): string {
        return points.toString();
    }

    // Convert counter to approximate timestamp (assuming 1 counter = 1 second)
    static counterToTimestamp(counter: bigint): Date {
        return new Date(Number(counter) * 1000);
    }

    // Calculate time difference in counters
    static counterDiff(from: bigint, to: bigint): bigint {
        return to > from ? to - from : 0n;
    }
}

// Player data interface
export interface PlayerData {
    userId: bigint[];
    points: bigint;
    totalStaked: bigint;
    lastStakeTime: bigint;
}

// Global state interface
export interface GlobalState {
    counter: bigint;
    totalPlayers: bigint;
    totalStaked: bigint;
}

// Player status with effective points
export interface PlayerStatus extends PlayerData {
    effectivePoints: bigint;
    currentCounter: bigint;
    }

// Utility functions for working with player data
export class PlayerUtils {
    // Create player status with effective points calculation
    static createPlayerStatus(
        playerData: PlayerData,
        currentCounter: bigint
    ): PlayerStatus {
        const effectivePoints = StakingCalculator.calculateEffectivePoints(
            playerData.points,
            playerData.totalStaked,
            playerData.lastStakeTime,
            currentCounter
        );

        return {
            ...playerData,
            effectivePoints,
            currentCounter
        };
    }

    // Convert user ID array to string representation
    static userIdToString(userId: bigint[]): string {
        return `${userId[0]}_${userId[1]}`;
    }

    // Convert string to user ID array
    static stringToUserId(userIdStr: string): bigint[] {
        const parts = userIdStr.split('_');
        return [BigInt(parts[0] || 0), BigInt(parts[1] || 0)];
    }

    // Validate player data
    static validatePlayerData(data: any): PlayerData | null {
        try {
            return {
                userId: [BigInt(data.userId[0]), BigInt(data.userId[1])],
                points: BigInt(data.points || 0),
                totalStaked: BigInt(data.totalStaked || 0),
                lastStakeTime: BigInt(data.lastStakeTime || 0)
            };
        } catch (error) {
            console.error('Invalid player data:', error);
            return null;
        }
    }
}

// Error handling
export class StakingError extends Error {
    public originalError?: any;

    constructor(message: string, originalError?: any) {
        super(message);
        this.name = 'StakingError';
        this.originalError = originalError;
    }
}

// Export utility functions
export function handleRpcError(error: any): never {
    if (error.code) {
        switch (error.code) {
            case 21:
                throw new StakingError("Insufficient stake amount");
            case 22:
                throw new StakingError("Invalid stake amount");
            case 23:
                throw new StakingError("Stake amount too small");
            case 24:
                throw new StakingError("Stake amount too large");
            case 25:
                throw new StakingError("No stake to withdraw");
            default:
                throw new StakingError(`Staking error: ${error.message || 'Unknown error'}`, error);
        }
    }
    throw new StakingError("Unknown staking error", error);
} 