import { Express } from "express";
import { Event, EventModel, Service, TxStateManager, TxWitness } from "zkwasm-ts-server";
import { merkleRootToBeHexString } from "zkwasm-ts-server/src/lib.js";
import mongoose from "mongoose";
import {
    StakingPlayer,
    userIdToString,
    stringToUserId,
    formatAmount,
    formatPoints,
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
const EVENT_INTEREST_CLAIMED = 9;
const EVENT_PRINCIPAL_REDEEMED = 10;
const EVENT_DEPOSIT = 11;
const EVENT_WITHDRAWAL = 12;
const EVENT_POINTS_WITHDRAWAL = 13;
const EVENT_ADMIN_WITHDRAWAL = 14;
const EVENT_RESERVE_RATIO_CHANGE = 15;
const EVENT_INDEXED_OBJECT = 5;

// Certificate info constants for IndexedObject
const PRODUCT_TYPE_INFO = 1;
const CERTIFICATE_INFO = 2;

// Note: Real-time calculations are done in event processing, not in REST endpoints
// REST endpoints return pre-calculated data from database

// MongoDB Schemas
const ProductTypeSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true }, // Store as string for better compatibility
    durationTicks: { type: String, required: true },
    apy: { type: String, required: true },
    minAmount: { type: String, required: true },
    isActive: { type: Boolean, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const CertificateSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    owner: [{ type: String, required: true }],
    productTypeId: { type: String, required: true },
    principal: { type: String, required: true },
    purchaseTime: { type: String, required: true },
    maturityTime: { type: String, required: true },
    lockedApy: { type: String, required: true },
    totalInterestClaimed: { type: String, required: true, default: "0" },
    // Pre-calculated fields updated by events
    availableInterest: { type: String, default: "0" },
    totalInterest: { type: String, default: "0" },
    isMatured: { type: Boolean, default: false },
    status: { type: String, enum: ['Active', 'Matured', 'Redeemed'], default: 'Active' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const InterestClaimSchema = new mongoose.Schema({
    userId: [{ type: String, required: true }],
    certificateId: { type: String, required: true },
    amount: { type: String, required: true },
    txid: { type: String, required: true },
    counter: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const PrincipalRedemptionSchema = new mongoose.Schema({
    userId: [{ type: String, required: true }],
    certificateId: { type: String, required: true },
    amount: { type: String, required: true },
    txid: { type: String, required: true },
    counter: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const CertificatePurchaseSchema = new mongoose.Schema({
    userId: [{ type: String, required: true }],
    certificateId: { type: String, required: true },
    productTypeId: { type: String, required: true },
    amount: { type: String, required: true },
    txid: { type: String, required: true },
    counter: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

// Withdrawal transaction schema
const WithdrawalSchema = new mongoose.Schema({
    userId: [{ type: String, required: true }],
    amount: { type: String, required: true },
    addressParts: [{ type: String, required: true }], // [first, middle, last]
    txid: { type: String, required: true },
    counter: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

// Deposit transaction schema  
const DepositSchema = new mongoose.Schema({
    adminId: [{ type: String, required: true }],
    userId: [{ type: String, required: true }],
    amount: { type: String, required: true },
    txid: { type: String, required: true },
    counter: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

// Points withdrawal transaction schema
const PointsWithdrawalSchema = new mongoose.Schema({
    userId: [{ type: String, required: true }],
    pointsAmount: { type: String, required: true },
    addressParts: [{ type: String, required: true }], // [first, middle, last]
    txid: { type: String, required: true },
    counter: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

// Admin withdrawal transaction schema
const AdminWithdrawalSchema = new mongoose.Schema({
    adminId: [{ type: String, required: true }],
    amount: { type: String, required: true },
    txid: { type: String, required: true },
    counter: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

// Public announcements - accessible by all users
const ProductTypeAnnouncementSchema = new mongoose.Schema({
    productTypeId: { type: String, required: true },
    action: { type: String, enum: ['create', 'modify'], required: true },
    details: {
        durationTicks: { type: String },
        apy: { type: String },
        minAmount: { type: String },
        isActive: { type: Boolean }
    },
    counter: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

// Models
const ProductTypeModel = mongoose.model('ProductType', ProductTypeSchema);
const CertificateModel = mongoose.model('Certificate', CertificateSchema);
const InterestClaimModel = mongoose.model('InterestClaim', InterestClaimSchema);
const PrincipalRedemptionModel = mongoose.model('PrincipalRedemption', PrincipalRedemptionSchema);
const CertificatePurchaseModel = mongoose.model('CertificatePurchase', CertificatePurchaseSchema);
const WithdrawalModel = mongoose.model('Withdrawal', WithdrawalSchema);
const DepositModel = mongoose.model('Deposit', DepositSchema);
const PointsWithdrawalModel = mongoose.model('PointsWithdrawal', PointsWithdrawalSchema);
const AdminWithdrawalModel = mongoose.model('AdminWithdrawal', AdminWithdrawalSchema);
const ProductTypeAnnouncementModel = mongoose.model('ProductTypeAnnouncement', ProductTypeAnnouncementSchema);

const service = new Service(eventCallback, batchedCallback, extra);
await service.initialize();

let txStateManager = new TxStateManager(merkleRootToBeHexString(service.merkleRoot));

function extra(app: Express) {
    // Certificate System REST API Endpoints
    
    // Get all product types from database
    app.get("/data/product-types", async (req: any, res) => {
        try {
            const productTypes = await ProductTypeModel.find({}).sort({ id: 1 });
            
            const formattedProductTypes = productTypes.map(pt => ({
                id: pt.id,
                durationTicks: pt.durationTicks,
                apy: pt.apy,
                minAmount: pt.minAmount,
                isActive: pt.isActive,
                formattedApy: ProductTypeManager.formatApy(BigInt(pt.apy)),
                formattedDuration: ProductTypeManager.formatDurationTicks(BigInt(pt.durationTicks)),
                createdAt: pt.createdAt,
                updatedAt: pt.updatedAt
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
    
    // Get user's certificates from database
    app.get("/data/user/:pid1/:pid2/certificates", async (req: any, res) => {
        try {
            const pid1 = req.params.pid1;
            const pid2 = req.params.pid2;
            
            const certificates = await CertificateModel.find({
                owner: [pid1, pid2]
            }).sort({ createdAt: -1 });
            
            // Return pre-calculated data from database - no real-time calculations
            const enrichedCertificates = certificates.map(cert => ({
                id: cert.id,
                owner: cert.owner,
                productTypeId: cert.productTypeId,
                principal: cert.principal,
                purchaseTime: cert.purchaseTime,
                maturityTime: cert.maturityTime,
                lockedApy: cert.lockedApy,
                totalInterestClaimed: cert.totalInterestClaimed,
                status: cert.status,
                formattedPrincipal: CertificateManager.formatPrincipal(BigInt(cert.principal)),
                formattedTotalInterestClaimed: CertificateManager.formatInterest(BigInt(cert.totalInterestClaimed)),
                formattedApy: ProductTypeManager.formatApy(BigInt(cert.lockedApy)),
                createdAt: cert.createdAt,
                updatedAt: cert.updatedAt
            }));
            
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
    
    // Get specific certificate details from database
    app.get("/data/certificate/:certId", async (req: any, res) => {
        try {
            const certId = req.params.certId;
            
            const cert = await CertificateModel.findOne({ id: certId });
            if (!cert) {
                return res.status(404).send({
                    success: false,
                    error: "Certificate not found"
                });
            }
            
            // Return pre-calculated data from database - no real-time calculations
            const response = {
                id: cert.id,
                owner: cert.owner,
                productTypeId: cert.productTypeId,
                principal: cert.principal,
                purchaseTime: cert.purchaseTime,
                maturityTime: cert.maturityTime,
                lockedApy: cert.lockedApy,
                totalInterestClaimed: cert.totalInterestClaimed,
                status: cert.status,
                formattedPrincipal: CertificateManager.formatPrincipal(BigInt(cert.principal)),
                formattedTotalInterestClaimed: CertificateManager.formatInterest(BigInt(cert.totalInterestClaimed)),
                formattedApy: ProductTypeManager.formatApy(BigInt(cert.lockedApy)),
                createdAt: cert.createdAt,
                updatedAt: cert.updatedAt
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
    
    // Get certificate system statistics from database
    app.get("/data/certificates/stats", async (req: any, res) => {
        try {
            const totalCertificates = await CertificateModel.countDocuments({});
            const activeCertificates = await CertificateModel.countDocuments({ status: 'Active' });
            const maturedCertificates = await CertificateModel.countDocuments({ status: 'Matured' });
            const redeemedCertificates = await CertificateModel.countDocuments({ status: 'Redeemed' });
            const totalProductTypes = await ProductTypeModel.countDocuments({ isActive: true });
            
            // Calculate totals from database data - no real-time calculations
            const certificates = await CertificateModel.find({});
            let totalPrincipal = 0n;
            let totalInterestClaimed = 0n;
            let totalApy = 0n;
            let validApyCount = 0;
            
            for (const cert of certificates) {
                const principal = BigInt(cert.principal);
                const apy = BigInt(cert.lockedApy);
                const interestClaimed = BigInt(cert.totalInterestClaimed);
                
                totalPrincipal += principal;
                totalInterestClaimed += interestClaimed;
                totalApy += apy;
                validApyCount++;
            }
            
            const averageApy = validApyCount > 0 ? totalApy / BigInt(validApyCount) : 0n;
            
            const stats = {
                totalCertificates,
                totalPrincipal: totalPrincipal.toString(),
                totalInterestClaimed: totalInterestClaimed.toString(),
                activeCertificates,
                maturedCertificates,
                redeemedCertificates,
                averageApy: averageApy.toString(),
                totalProductTypes
            };
            
            res.status(200).send({
                success: true,
                data: stats
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
            const { principal, apyBasisPoints, durationTicks } = req.body;
            
            if (!principal || !apyBasisPoints || !durationTicks) {
                return res.status(400).send({
                    success: false,
                    error: "Missing required parameters: principal, apyBasisPoints, durationTicks"
                });
            }
            
            const principalBig = BigInt(principal);
            const apyBig = BigInt(apyBasisPoints);
            const durationBig = BigInt(durationTicks);
            
            const totalInterest = CertificateCalculator.calculateInterestForPeriod(principalBig, apyBig, durationBig);
            const dailyInterest = CertificateCalculator.calculateDailyInterest(principalBig, apyBig);
            const annualInterest = CertificateCalculator.calculateAnnualInterest(principalBig, apyBig);
            
            res.status(200).send({
                success: true,
                data: {
                    principal: principalBig.toString(),
                    apy: apyBig.toString(),
                    durationTicks: durationBig.toString(),
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

    // Get user's transaction history
    app.get("/data/user/:pid1/:pid2/history", async (req: any, res) => {
        try {
            const pid1 = req.params.pid1;
            const pid2 = req.params.pid2;
            
            // Get all types of user transactions
            const certificatePurchases = await CertificatePurchaseModel.find({
                userId: [pid1, pid2]
            }).sort({ createdAt: -1 });
            
            const interestClaims = await InterestClaimModel.find({
                userId: [pid1, pid2]
            }).sort({ createdAt: -1 });
            
            const principalRedemptions = await PrincipalRedemptionModel.find({
                userId: [pid1, pid2]
            }).sort({ createdAt: -1 });
            
            const withdrawals = await WithdrawalModel.find({
                userId: [pid1, pid2]
            }).sort({ createdAt: -1 });
            
            const deposits = await DepositModel.find({
                userId: [pid1, pid2]
            }).sort({ createdAt: -1 });
            
            const pointsWithdrawals = await PointsWithdrawalModel.find({
                userId: [pid1, pid2]
            }).sort({ createdAt: -1 });
            
            const history = [
                ...certificatePurchases.map(purchase => ({
                    type: 'certificate_purchase',
                    certificateId: purchase.certificateId,
                    productTypeId: purchase.productTypeId,
                    amount: purchase.amount,
                    txid: purchase.txid,
                    counter: purchase.counter,
                    createdAt: purchase.createdAt
                })),
                ...interestClaims.map(claim => ({
                    type: 'interest_claim',
                    certificateId: claim.certificateId,
                    amount: claim.amount,
                    txid: claim.txid,
                    counter: claim.counter,
                    createdAt: claim.createdAt
                })),
                ...principalRedemptions.map(redemption => ({
                    type: 'principal_redemption',
                    certificateId: redemption.certificateId,
                    amount: redemption.amount,
                    txid: redemption.txid,
                    counter: redemption.counter,
                    createdAt: redemption.createdAt
                })),
                ...withdrawals.map(withdrawal => ({
                    type: 'withdrawal',
                    amount: withdrawal.amount,
                    addressParts: withdrawal.addressParts,
                    txid: withdrawal.txid,
                    counter: withdrawal.counter,
                    createdAt: withdrawal.createdAt
                })),
                ...deposits.map(deposit => ({
                    type: 'deposit',
                    amount: deposit.amount,
                    adminId: deposit.adminId,
                    txid: deposit.txid,
                    counter: deposit.counter,
                    createdAt: deposit.createdAt
                })),
                ...pointsWithdrawals.map(pointsWithdrawal => ({
                    type: 'points_withdrawal',
                    pointsAmount: pointsWithdrawal.pointsAmount,
                    addressParts: pointsWithdrawal.addressParts,
                    txid: pointsWithdrawal.txid,
                    counter: pointsWithdrawal.counter,
                    createdAt: pointsWithdrawal.createdAt
                }))
            ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            
            res.status(200).send({
                success: true,
                data: history
            });
        } catch (e: any) {
            console.error("Error fetching user history:", e);
            res.status(500).send({
                success: false,
                error: "Failed to fetch user history"
            });
        }
    });

    // Get public product type announcements (accessible by all users)
    app.get("/data/announcements", async (req: any, res) => {
        try {
            const announcements = await ProductTypeAnnouncementModel.find({})
                .sort({ createdAt: -1 })
                .limit(50); // Limit to recent 50 announcements
            
            const publicAnnouncements = announcements.map(announcement => ({
                type: 'product_type_' + announcement.action,
                productTypeId: announcement.productTypeId,
                action: announcement.action,
                details: announcement.details,
                counter: announcement.counter,
                createdAt: announcement.createdAt
                // Note: txid and admin info not exposed for privacy
            }));
            
            res.status(200).send({
                success: true,
                data: publicAnnouncements
            });
        } catch (e: any) {
            console.error("Error fetching announcements:", e);
            res.status(500).send({
                success: false,
                error: "Failed to fetch announcements"
            });
        }
    });
}

service.serve();

async function batchedCallback(_arg: TxWitness[], _preMerkle: string, postMerkle: string) {
    await txStateManager.moveToCommit(postMerkle);
}

async function eventCallback(arg: TxWitness, data: BigUint64Array) {
    console.log("Event callback triggered with data:", data);

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
        
        try {
            switch (eventType) {
                case EVENT_INDEXED_OBJECT:
                    console.log("=== Processing Certificate IndexedObject event ===");
                    console.log("Event data:", Array.from(eventData));
                    let objectIndex = Number(eventData[0]);
                    let objectId = eventData[1].toString();
                    
                    if (objectIndex === PRODUCT_TYPE_INFO) {
                        console.log("This is a ProductType IndexedObject, ID:", objectId);
                        // Extract ProductType data from event
                        let productTypeData = eventData.slice(2);
                        let productType = {
                            id: objectId,
                            durationTicks: productTypeData[0]?.toString() || "0",
                            apy: productTypeData[1]?.toString() || "0",
                            minAmount: productTypeData[2]?.toString() || "0",
                            isActive: (productTypeData[3] || 0n) !== 0n
                        };
                        
                        await ProductTypeModel.findOneAndUpdate(
                            { id: objectId },
                            { ...productType, updatedAt: new Date() },
                            { upsert: true }
                        );
                        console.log("ProductType stored:", productType);
                        
                    } else if (objectIndex === CERTIFICATE_INFO) {
                        console.log("This is a Certificate IndexedObject, ID:", objectId);
                        // Extract Certificate data from event
                        let certData = eventData.slice(2);
                        let certificate = {
                            id: objectId,
                            owner: [certData[0]?.toString() || "0", certData[1]?.toString() || "0"],
                            productTypeId: certData[2]?.toString() || "0",
                            principal: certData[3]?.toString() || "0",
                            purchaseTime: certData[4]?.toString() || "0",
                            maturityTime: certData[5]?.toString() || "0",
                            lockedApy: certData[6]?.toString() || "0",
                            totalInterestClaimed: certData[7]?.toString() || "0",
                            status: 'Active' as CertificateStatus
                        };
                        
                        await CertificateModel.findOneAndUpdate(
                            { id: objectId },
                            { ...certificate, updatedAt: new Date() },
                            { upsert: true }
                        );
                        console.log("Certificate stored:", certificate);
                    }
                    break;

                case EVENT_CERTIFICATE_PURCHASED:
                    console.log("=== Processing Certificate Purchase event ===");
                    let purchaseUserId = [eventData[0]?.toString() || "0", eventData[1]?.toString() || "0"];
                    let purchaseCertificateId = eventData[2]?.toString() || "0";
                    let purchaseProductTypeId = eventData[3]?.toString() || "0";
                    let purchaseAmount = eventData[4]?.toString() || "0";
                    let purchaseTxid = eventData[5]?.toString() || "0";
                    let purchaseCounter = eventData[6]?.toString() || "0";
                    
                    console.log(`Certificate purchased: user ${purchaseUserId[0]}_${purchaseUserId[1]}, cert ${purchaseCertificateId}, amount ${purchaseAmount}`);
                    
                    // Store purchase transaction to database
                    await new CertificatePurchaseModel({
                        userId: purchaseUserId,
                        certificateId: purchaseCertificateId,
                        productTypeId: purchaseProductTypeId,
                        amount: purchaseAmount,
                        txid: purchaseTxid,
                        counter: purchaseCounter
                    }).save();
                    break;

                case EVENT_PRODUCT_TYPE_CREATED:
                case EVENT_PRODUCT_TYPE_MODIFIED:
                    const actionType = eventType === EVENT_PRODUCT_TYPE_CREATED ? 'create' : 'modify';
                    console.log(`=== Processing Product Type ${actionType} event ===`);
                    
                    // Event structure: [admin_id[0], admin_id[1], product_type_id, duration_ticks, apy, min_amount, is_active, counter]
                    // Note: Admin ID not stored in public announcements for privacy
                    let adminId1 = eventData[0]?.toString() || "0";
                    let adminId2 = eventData[1]?.toString() || "0"; 
                    let productId = eventData[2]?.toString() || "0";
                    let durationTicks = eventData[3]?.toString() || "0";
                    let apyValue = eventData[4]?.toString() || "0";
                    let minAmountValue = eventData[5]?.toString() || "0";
                    let isActiveValue = (eventData[6] || 0n) !== 0n;
                    let adminCounter = eventData[7]?.toString() || "0";
                    
                    console.log(`Product ${actionType}: admin ${adminId1}_${adminId2}, product ${productId}`);
                    
                    // Store public announcement (no admin ID for privacy)
                    await new ProductTypeAnnouncementModel({
                        productTypeId: productId,
                        action: actionType,
                        details: {
                            durationTicks,
                            apy: apyValue,
                            minAmount: minAmountValue,
                            isActive: isActiveValue
                        },
                        counter: adminCounter
                    }).save();
                    break;

                case EVENT_INTEREST_CLAIMED:
                    console.log("=== Processing Interest Claim event ===");
                    let userId = [eventData[0]?.toString() || "0", eventData[1]?.toString() || "0"];
                    let certificateId = eventData[2]?.toString() || "0";
                    let amount = eventData[3]?.toString() || "0";
                    let txid = eventData[4]?.toString() || "0";
                    let counter = eventData[5]?.toString() || "0";
                    
                    console.log(`Interest claimed: user ${userId[0]}_${userId[1]}, cert ${certificateId}, amount ${amount}`);
                    
                    // Store claim event to database
                    await new InterestClaimModel({
                        userId,
                        certificateId,
                        amount,
                        txid,
                        counter
                    }).save();
                    
                    // Update certificate's totalInterestClaimed
                    const cert = await CertificateModel.findOne({ id: certificateId });
                    if (cert) {
                        const newTotal = BigInt(cert.totalInterestClaimed) + BigInt(amount);
                        await CertificateModel.findOneAndUpdate(
                            { id: certificateId },
                            { totalInterestClaimed: newTotal.toString(), updatedAt: new Date() }
                        );
                    }
                    break;

                case EVENT_PRINCIPAL_REDEEMED:
                    console.log("=== Processing Principal Redemption event ===");
                    let userIdRedemption = [eventData[0]?.toString() || "0", eventData[1]?.toString() || "0"];
                    let certificateIdRedemption = eventData[2]?.toString() || "0";
                    let amountRedemption = eventData[3]?.toString() || "0";
                    let txidRedemption = eventData[4]?.toString() || "0";
                    let counterRedemption = eventData[5]?.toString() || "0";
                    
                    console.log(`Principal redeemed: user ${userIdRedemption[0]}_${userIdRedemption[1]}, cert ${certificateIdRedemption}, amount ${amountRedemption}`);
                    
                    // Store redemption event to database
                    await new PrincipalRedemptionModel({
                        userId: userIdRedemption,
                        certificateId: certificateIdRedemption,
                        amount: amountRedemption,
                        txid: txidRedemption,
                        counter: counterRedemption
                    }).save();
                    
                    // Update certificate status to Redeemed
                    await CertificateModel.findOneAndUpdate(
                        { id: certificateIdRedemption },
                        { status: 'Redeemed', updatedAt: new Date() }
                    );
                    break;

                case EVENT_WITHDRAWAL:
                    console.log("=== Processing Withdrawal event ===");
                    // Event structure: [user_id[0], user_id[1], amount, address_parts[0], address_parts[1], address_parts[2], txid, counter]
                    let withdrawalUserId = [eventData[0]?.toString() || "0", eventData[1]?.toString() || "0"];
                    let withdrawalAmount = eventData[2]?.toString() || "0";
                    let withdrawalAddressParts = [
                        eventData[3]?.toString() || "0",
                        eventData[4]?.toString() || "0", 
                        eventData[5]?.toString() || "0"
                    ];
                    let withdrawalTxid = eventData[6]?.toString() || "0";
                    let withdrawalCounter = eventData[7]?.toString() || "0";
                    
                    console.log(`Withdrawal: user ${withdrawalUserId[0]}_${withdrawalUserId[1]}, amount ${withdrawalAmount}`);
                    
                    await new WithdrawalModel({
                        userId: withdrawalUserId,
                        amount: withdrawalAmount,
                        addressParts: withdrawalAddressParts,
                        txid: withdrawalTxid,
                        counter: withdrawalCounter
                    }).save();
                    break;

                case EVENT_DEPOSIT:
                    console.log("=== Processing Deposit event ===");
                    // Event structure: [admin_id[0], admin_id[1], user_id[0], user_id[1], amount, txid, counter]
                    let depositAdminId = [eventData[0]?.toString() || "0", eventData[1]?.toString() || "0"];
                    let depositUserId = [eventData[2]?.toString() || "0", eventData[3]?.toString() || "0"];
                    let depositAmount = eventData[4]?.toString() || "0";
                    let depositTxid = eventData[5]?.toString() || "0";
                    let depositCounter = eventData[6]?.toString() || "0";
                    
                    console.log(`Deposit: admin ${depositAdminId[0]}_${depositAdminId[1]} -> user ${depositUserId[0]}_${depositUserId[1]}, amount ${depositAmount}`);
                    
                    await new DepositModel({
                        adminId: depositAdminId,
                        userId: depositUserId,
                        amount: depositAmount,
                        txid: depositTxid,
                        counter: depositCounter
                    }).save();
                    break;

                case EVENT_POINTS_WITHDRAWAL:
                    console.log("=== Processing Points Withdrawal event ===");
                    // Event structure: [user_id[0], user_id[1], points_amount, address_parts[0], address_parts[1], address_parts[2], txid, counter]
                    let pointsWithdrawalUserId = [eventData[0]?.toString() || "0", eventData[1]?.toString() || "0"];
                    let pointsWithdrawalAmount = eventData[2]?.toString() || "0";
                    let pointsWithdrawalAddressParts = [
                        eventData[3]?.toString() || "0",
                        eventData[4]?.toString() || "0",
                        eventData[5]?.toString() || "0"
                    ];
                    let pointsWithdrawalTxid = eventData[6]?.toString() || "0";
                    let pointsWithdrawalCounter = eventData[7]?.toString() || "0";
                    
                    console.log(`Points Withdrawal: user ${pointsWithdrawalUserId[0]}_${pointsWithdrawalUserId[1]}, points ${pointsWithdrawalAmount}`);
                    
                    await new PointsWithdrawalModel({
                        userId: pointsWithdrawalUserId,
                        pointsAmount: pointsWithdrawalAmount,
                        addressParts: pointsWithdrawalAddressParts,
                        txid: pointsWithdrawalTxid,
                        counter: pointsWithdrawalCounter
                    }).save();
                    break;

                case EVENT_ADMIN_WITHDRAWAL:
                    console.log("=== Processing Admin Withdrawal event ===");
                    // Event structure: [admin_id[0], admin_id[1], amount, txid, counter]
                    let adminWithdrawalAdminId = [eventData[0]?.toString() || "0", eventData[1]?.toString() || "0"];
                    let adminWithdrawalAmount = eventData[2]?.toString() || "0";
                    let adminWithdrawalTxid = eventData[3]?.toString() || "0";
                    let adminWithdrawalCounter = eventData[4]?.toString() || "0";
                    
                    console.log(`Admin Withdrawal: admin ${adminWithdrawalAdminId[0]}_${adminWithdrawalAdminId[1]}, amount ${adminWithdrawalAmount}`);
                    
                    await new AdminWithdrawalModel({
                        adminId: adminWithdrawalAdminId,
                        amount: adminWithdrawalAmount,
                        txid: adminWithdrawalTxid,
                        counter: adminWithdrawalCounter
                    }).save();
                    break;

                case EVENT_RESERVE_RATIO_CHANGE:
                    console.log("=== Processing Reserve Ratio Change event ===");
                    // Event structure: [admin_id[0], admin_id[1], old_ratio, new_ratio, counter]
                    // This is a public announcement event, no individual transaction record needed
                    let ratioChangeAdminId = [eventData[0]?.toString() || "0", eventData[1]?.toString() || "0"];
                    let oldRatio = eventData[2]?.toString() || "0";
                    let newRatio = eventData[3]?.toString() || "0";
                    let ratioChangeCounter = eventData[4]?.toString() || "0";
                    
                    console.log(`Reserve Ratio Change: admin ${ratioChangeAdminId[0]}_${ratioChangeAdminId[1]}, ${oldRatio} -> ${newRatio}`);
                    // Note: Reserve ratio changes are administrative announcements, no database storage needed
                    break;

                default:
                    console.log("Unhandled event type:", eventType);
                    break;
            }
        } catch (eventError: any) {
            console.error(`Error processing event type ${eventType}:`, eventError);
        }

        i += 1 + Number(eventLength);
    }
}

export default service;