import { Express } from "express";
import { Event, EventModel, Service, TxStateManager, TxWitness } from "zkwasm-ts-server";
import { merkleRootToBeHexString } from "zkwasm-ts-server/src/lib.js";
import {
    StakingPlayer,
    userIdToString,
    stringToUserId,
    formatAmount,
    formatPoints,
    getCurrentCounter,
    ProductType,
    Certificate,
    CertificateStatus,
    CertificateInfo,
    ProductTypeManager,
    CertificateManager,
    CertificateCalculator
} from "./models.js";

// Event constants matching config.rs
const EVENT_PRODUCT_TYPE_CREATED = 6;
const EVENT_PRODUCT_TYPE_MODIFIED = 7;
const EVENT_CERTIFICATE_PURCHASED = 8;
const EVENT_INTEREST_WITHDRAWN = 9;
const EVENT_PRINCIPAL_REDEEMED = 10;
const EVENT_INDEXED_OBJECT = 5;

// Certificate info constants for IndexedObject
const PRODUCT_TYPE_INFO = 1;
const CERTIFICATE_INFO = 2;

const service = new Service(eventCallback, batchedCallback, extra);
await service.initialize();

let txStateManager = new TxStateManager(merkleRootToBeHexString(service.merkleRoot));

function extra(app: Express) {
    // Certificate System REST API Endpoints
    // Following zkwasm-launchpad pattern for consistent API design
    
    // Get all product types
    app.get("/data/product-types", async (req: any, res) => {
        try {
            // TODO: Query product types from blockchain storage
            // For now, return mock data matching the expected structure
            const mockProductTypes: ProductType[] = [
                {
                    id: 1n,
                    durationDays: 7n,
                    apy: 600n, // 6% APY
                    minAmount: 1000n,
                    isActive: true
                },
                {
                    id: 2n,
                    durationDays: 30n,
                    apy: 1200n, // 12% APY
                    minAmount: 5000n,
                    isActive: true
                },
                {
                    id: 3n,
                    durationDays: 90n,
                    apy: 2000n, // 20% APY
                    minAmount: 20000n,
                    isActive: true
                }
            ];
            
            const formattedProductTypes = mockProductTypes.map(pt => ({
                ...pt,
                id: pt.id.toString(),
                durationDays: pt.durationDays.toString(),
                apy: pt.apy.toString(),
                minAmount: pt.minAmount.toString(),
                formattedApy: ProductTypeManager.formatApy(pt.apy),
                formattedDuration: ProductTypeManager.formatDuration(pt.durationDays)
            }));
            
            res.status(200).send({
                success: true,
                data: formattedProductTypes
            });
        } catch (e: any) {
            console.error("Error fetching product types:", e);
            res.status(500).send({
                success: false,
                error: "Failed to fetch product types"
            });
        }
    });
    
    // Get user's certificates
    app.get("/data/user/:pid1/:pid2/certificates", async (req: any, res) => {
        try {
            const pid1 = req.params.pid1;
            const pid2 = req.params.pid2;
            const currentTime = await getCurrentCounter();
            
            // TODO: Query certificates from blockchain storage using event data
            // Mock data uses consistent time calculations
            const SECONDS_PER_TICK = 5n;
            const COUNTERS_PER_DAY = (24n * 60n * 60n) / SECONDS_PER_TICK; // 17280
            
            const mockCertificates: Certificate[] = [
                {
                    id: 1n,
                    owner: [BigInt(pid1), BigInt(pid2)],
                    productTypeId: 1n,
                    principal: 10000n,
                    purchaseTime: currentTime - COUNTERS_PER_DAY, // 1 day ago (in counters)
                    maturityTime: currentTime + (7n * COUNTERS_PER_DAY - COUNTERS_PER_DAY), // 6 days from now
                    lockedApy: 600n,
                    lastInterestClaim: currentTime - COUNTERS_PER_DAY,
                    status: CertificateStatus.Active
                }
            ];
            
            const enrichedCertificates = mockCertificates.map(cert => {
                const info = CertificateManager.getCertificateInfo(cert, currentTime);
                return {
                    ...info.certificate,
                    id: info.certificate.id.toString(),
                    owner: info.certificate.owner.map(o => o.toString()),
                    productTypeId: info.certificate.productTypeId.toString(),
                    principal: info.certificate.principal.toString(),
                    purchaseTime: info.certificate.purchaseTime.toString(),
                    maturityTime: info.certificate.maturityTime.toString(),
                    lockedApy: info.certificate.lockedApy.toString(),
                    lastInterestClaim: info.certificate.lastInterestClaim.toString(),
                    availableInterest: info.availableInterest.toString(),
                    totalInterest: info.totalInterest.toString(),
                    formattedPrincipal: CertificateManager.formatPrincipal(info.certificate.principal),
                    formattedAvailableInterest: CertificateManager.formatInterest(info.availableInterest),
                    formattedTotalInterest: CertificateManager.formatInterest(info.totalInterest),
                    formattedApy: ProductTypeManager.formatApy(info.certificate.lockedApy),
                    isMatured: CertificateManager.isMatured(info.certificate, currentTime)
                };
            });
            
            res.status(200).send({
                success: true,
                data: enrichedCertificates
            });
        } catch (e: any) {
            console.error("Error fetching user certificates:", e);
            res.status(500).send({
                success: false,
                error: "Failed to fetch user certificates"
            });
        }
    });
    
    // Get specific certificate details
    app.get("/data/certificate/:certId", async (req: any, res) => {
        try {
            const certId = req.params.certId;
            const currentTime = await getCurrentCounter();
            
            // TODO: Query specific certificate from blockchain storage using event data
            // Mock data uses consistent time calculations
            const SECONDS_PER_TICK = 5n;
            const COUNTERS_PER_DAY = (24n * 60n * 60n) / SECONDS_PER_TICK; // 17280
            
            const mockCert: Certificate = {
                id: BigInt(certId),
                owner: [123n, 456n],
                productTypeId: 1n,
                principal: 10000n,
                purchaseTime: currentTime - COUNTERS_PER_DAY,
                maturityTime: currentTime + (7n * COUNTERS_PER_DAY - COUNTERS_PER_DAY),
                lockedApy: 600n,
                lastInterestClaim: currentTime - COUNTERS_PER_DAY,
                status: CertificateStatus.Active
            };
            
            const info = CertificateManager.getCertificateInfo(mockCert, currentTime);
            
            const response = {
                ...info.certificate,
                id: info.certificate.id.toString(),
                owner: info.certificate.owner.map(o => o.toString()),
                productTypeId: info.certificate.productTypeId.toString(),
                principal: info.certificate.principal.toString(),
                purchaseTime: info.certificate.purchaseTime.toString(),
                maturityTime: info.certificate.maturityTime.toString(),
                lockedApy: info.certificate.lockedApy.toString(),
                lastInterestClaim: info.certificate.lastInterestClaim.toString(),
                availableInterest: info.availableInterest.toString(),
                totalInterest: info.totalInterest.toString(),
                currentTime: info.currentTime.toString(),
                formattedPrincipal: CertificateManager.formatPrincipal(info.certificate.principal),
                formattedAvailableInterest: CertificateManager.formatInterest(info.availableInterest),
                formattedTotalInterest: CertificateManager.formatInterest(info.totalInterest),
                formattedApy: ProductTypeManager.formatApy(info.certificate.lockedApy),
                isMatured: CertificateManager.isMatured(info.certificate, currentTime)
            };
            
            res.status(200).send({
                success: true,
                data: response
            });
        } catch (e: any) {
            console.error("Error fetching certificate:", e);
            res.status(500).send({
                success: false,
                error: "Failed to fetch certificate"
            });
        }
    });
    
    // Get certificate system statistics
    app.get("/data/certificates/stats", async (req: any, res) => {
        try {
            // TODO: Query actual statistics from blockchain storage
            // For now, return mock data
            const mockStats = {
                totalCertificates: 42,
                totalPrincipal: "1250000", // 1.25M USDT
                totalAvailableInterest: "15620", // 15.62K USDT
                activeCertificates: 35,
                maturedCertificates: 5,
                redeemedCertificates: 2,
                averageApy: "1450", // 14.5% average APY
                totalProductTypes: 5
            };
            
            res.status(200).send({
                success: true,
                data: mockStats
            });
        } catch (e: any) {
            console.error("Error fetching certificate stats:", e);
            res.status(500).send({
                success: false,
                error: "Failed to fetch certificate stats"
            });
        }
    });
    
    // Calculate certificate interest projection
    app.post("/data/certificate/calculate", async (req: any, res) => {
        try {
            const { principal, apyBasisPoints, durationDays } = req.body;
            
            if (!principal || !apyBasisPoints || !durationDays) {
                return res.status(400).send({
                    success: false,
                    error: "Missing required parameters: principal, apyBasisPoints, durationDays"
                });
            }
            
            const principalBig = BigInt(principal);
            const apyBig = BigInt(apyBasisPoints);
            const durationBig = BigInt(durationDays);
            
            const counters = CertificateCalculator.daysToCounters(durationBig);
            const totalInterest = CertificateCalculator.calculateInterestForPeriod(principalBig, apyBig, counters);
            const dailyInterest = CertificateCalculator.calculateDailyInterest(principalBig, apyBig);
            const annualInterest = CertificateCalculator.calculateAnnualInterest(principalBig, apyBig);
            
            res.status(200).send({
                success: true,
                data: {
                    principal: principalBig.toString(),
                    apy: apyBig.toString(),
                    durationDays: durationBig.toString(),
                    totalInterest: totalInterest.toString(),
                    dailyInterest: dailyInterest.toString(),
                    annualInterest: annualInterest.toString(),
                    formattedApy: CertificateCalculator.formatApy(apyBig),
                    formattedPrincipal: CertificateManager.formatPrincipal(principalBig),
                    formattedTotalInterest: CertificateManager.formatInterest(totalInterest),
                    formattedDailyInterest: CertificateManager.formatInterest(dailyInterest),
                    formattedAnnualInterest: CertificateManager.formatInterest(annualInterest)
                }
            });
        } catch (e: any) {
            console.error("Error calculating certificate projection:", e);
            res.status(500).send({
                success: false,
                error: "Failed to calculate certificate projection"
            });
        }
    });
}

service.serve();

// Duplicate constants removed - using the ones defined at the top

async function batchedCallback(_arg: TxWitness[], _preMerkle: string, postMerkle: string) {
    await txStateManager.moveToCommit(postMerkle);
}

async function eventCallback(arg: TxWitness, data: BigUint64Array) {
    console.log("Event callback triggered with data:", data);

    // Currently no events are being emitted from the Rust code
    // This function would process staking events when they are implemented

    if (data.length == 0) {
        return;
    }

    if (data[0] != 0n) {
        console.error("Transaction failed with error code:", data[0]);
        return;
    }
    if (data.length <= 2) {
        return;
    }

    let event = new Event(data[1], data);
    let doc = new EventModel({
        id: event.id.toString(),
        data: Buffer.from(event.data.buffer)
    });

    try {
        let result = await doc.save();
        if (!result) {
            console.error("Failed to save event");
            throw new Error("save event to db failed");
        }
    } catch (e) {
        console.error("Event save error:", e);
    }

    // Process certificate system events
    let i = 2; // start position
    while (i < data.length) {
        let eventType = Number(data[i] >> 32n);
        let eventLength = data[i] & ((1n << 32n) - 1n);
        let eventData = data.slice(i + 1, i + 1 + Number(eventLength));
        console.log("Processing event type:", eventType, "length:", eventLength);
        
        switch (eventType) {
            case EVENT_INDEXED_OBJECT:
                try {
                    console.log("=== Processing Certificate IndexedObject event ===");
                    console.log("Event data:", Array.from(eventData));
                    let objectIndex = Number(eventData[0]);
                    let objectId = Number(eventData[1]);
                    
                    if (objectIndex === PRODUCT_TYPE_INFO) {
                        console.log("This is a ProductType IndexedObject, ID:", objectId);
                        // TODO: Store ProductType data to database/cache
                        // let productTypeData = eventData.slice(2);
                        // let productType = ProductTypeManager.fromData(productTypeData);
                    } else if (objectIndex === CERTIFICATE_INFO) {
                        console.log("This is a Certificate IndexedObject, ID:", objectId);
                        // TODO: Store Certificate data to database/cache
                        // let certData = eventData.slice(2);
                        // let certificate = CertificateManager.fromData(certData);
                    }
                } catch (e: any) {
                    console.error("Error processing IndexedObject:", e);
                }
                break;

            case EVENT_INTEREST_WITHDRAWN:
                try {
                    console.log("=== Processing Interest Withdrawal event ===");
                    let userId = [eventData[0], eventData[1]];
                    let certificateId = eventData[2];
                    let amount = eventData[3];
                    let txid = eventData[4];
                    let timestamp = eventData[5];
                    console.log(`Interest withdrawn: user ${userId[0]}_${userId[1]}, cert ${certificateId}, amount ${amount}`);
                    // TODO: Store withdrawal event to database
                } catch (e: any) {
                    console.error("Error processing interest withdrawal:", e);
                }
                break;

            case EVENT_PRINCIPAL_REDEEMED:
                try {
                    console.log("=== Processing Principal Redemption event ===");
                    let userId = [eventData[0], eventData[1]];
                    let certificateId = eventData[2];
                    let amount = eventData[3];
                    let txid = eventData[4];
                    let timestamp = eventData[5];
                    console.log(`Principal redeemed: user ${userId[0]}_${userId[1]}, cert ${certificateId}, amount ${amount}`);
                    // TODO: Store redemption event to database
                } catch (e: any) {
                    console.error("Error processing principal redemption:", e);
                }
                break;

            default:
                console.log("Unhandled event type:", eventType);
                break;
        }

        i += 1 + Number(eventLength);
    }
}

export default service;
