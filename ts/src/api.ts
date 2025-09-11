// Certificate system API - focused on idle funds and static points
export class CertificateCalculator {
    // Calculate effective points (now static - no automatic accumulation)
    static calculateEffectivePoints(points: bigint): bigint {
        return points; // Certificate system: points are static
    }

    // Format counter for display 
    static formatCounter(counter: bigint): string {
        return counter.toString();
    }

    // Format amount for display
    static formatAmount(amount: bigint): string {
        return amount.toString();
    }

    // Format points for display
    static formatPoints(points: bigint): string {
        return points.toString();
    }

    // Convert counter to approximate timestamp (5 seconds per tick)
    static counterToTimestamp(counter: bigint): Date {
        return new Date(Number(counter) * 5000); // 5 seconds per tick
    }

    // Calculate time difference in counters
    static counterDiff(from: bigint, to: bigint): bigint {
        return to > from ? to - from : 0n;
    }

    // Convert days to ticks for certificate duration
    static daysToTicks(days: bigint): bigint {
        return days * 17280n; // 17280 ticks per day (5 seconds per tick)
    }

    // Convert ticks to days
    static ticksToDays(ticks: bigint): bigint {
        return ticks / 17280n;
    }
}

// Player data interface (certificate system)
export interface PlayerData {
    userId: bigint[];
    points: bigint;
    idleFunds: bigint;
}

// Global state interface (certificate system)
export interface GlobalState {
    counter: bigint;
    totalPlayers: bigint;
    totalFunds: bigint;
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
        const effectivePoints = CertificateCalculator.calculateEffectivePoints(
            playerData.points
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

    // Validate player data (certificate system)
    static validatePlayerData(data: any): PlayerData | null {
        try {
            return {
                userId: [BigInt(data.userId[0]), BigInt(data.userId[1])],
                points: BigInt(data.points || 0),
                idleFunds: BigInt(data.idleFunds || 0)
            };
        } catch (error) {
            console.error('Invalid player data:', error);
            return null;
        }
    }
}

// Error handling
export class CertificateError extends Error {
    public originalError?: any;

    constructor(message: string, originalError?: any) {
        super(message);
        this.name = 'CertificateError';
        this.originalError = originalError;
    }
}

// Export utility functions
export function handleRpcError(error: any): never {
    if (error.code) {
        switch (error.code) {
            case 51:
                throw new CertificateError("Product type not exist");
            case 52:
                throw new CertificateError("Product type inactive");
            case 53:
                throw new CertificateError("Certificate not exist");
            case 54:
                throw new CertificateError("Certificate not owned");
            case 55:
                throw new CertificateError("Certificate not matured");
            case 56:
                throw new CertificateError("Certificate already redeemed");
            case 57:
                throw new CertificateError("Insufficient interest");
            case 58:
                throw new CertificateError("Invalid principal amount");
            case 59:
                throw new CertificateError("Principal amount too small");
            case 60:
                throw new CertificateError("Invalid APY");
            case 61:
                throw new CertificateError("Invalid duration");
            default:
                throw new CertificateError(`Certificate error: ${error.message || 'Unknown error'}`, error);
        }
    }
    throw new CertificateError("Unknown certificate error", error);
}