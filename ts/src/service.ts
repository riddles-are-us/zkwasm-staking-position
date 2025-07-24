import { Express } from "express";
import { Event, EventModel, Service, TxStateManager, TxWitness } from "zkwasm-ts-server";
import { merkleRootToBeHexString } from "zkwasm-ts-server/src/lib.js";
import {
    StakingPlayer,
    userIdToString,
    stringToUserId,
    formatStakeAmount,
    formatPoints,
    getCurrentCounter
} from "./models.js";

const service = new Service(eventCallback, batchedCallback, extra);
await service.initialize();

let txStateManager = new TxStateManager(merkleRootToBeHexString(service.merkleRoot));

function extra(app: Express) {
    // API endpoints are currently not functional
    // 
    // These endpoints were designed to query staking data from the database,
    // but since we haven't implemented events in the Rust code yet,
    // there's no data being stored in the database.
    //
    // To enable these endpoints, we would need to:
    // 1. Add event.rs file to the Rust project
    // 2. Emit events for DEPOSIT and WITHDRAW operations in command.rs
    // 3. Process these events in the eventCallback function below
    //
    // For now, all staking data should be queried directly from the blockchain state

    // Example of how endpoints would look when events are implemented:
    /*
    app.get("/data/players", async (req: any, res) => {
        const counter = req.query.counter ? BigInt(req.query.counter) : await getCurrentCounter();
        // Query players from database and calculate effective points
    });

    app.get("/data/player/:userId/status", async (req: any, res) => {
        const counter = req.query.counter ? BigInt(req.query.counter) : await getCurrentCounter();
        // Query specific player and calculate effective points
    });
    */
}

service.serve();

// Event constants for staking system (when implemented)
const EVENT_STAKING_DEPOSIT = 1;
const EVENT_STAKING_WITHDRAW = 2;
const EVENT_PLAYER_UPDATE = 3;

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

    // When events are implemented, process them here:
    /*
    let i = 2; // start pos
    while (i < data.length) {
        let eventType = Number(data[i] >> 32n);
        let eventLength = data[i] & ((1n << 32n) - 1n);
        let eventData = data.slice(i + 1, i + 1 + Number(eventLength));

        switch (eventType) {
            case EVENT_STAKING_DEPOSIT:
                await handleStakingDepositEvent(arg, eventData);
                break;
            case EVENT_STAKING_WITHDRAW:
                await handleStakingWithdrawEvent(arg, eventData);
                break;
            case EVENT_PLAYER_UPDATE:
                await handlePlayerUpdateEvent(arg, eventData);
                break;
            default:
                console.warn("Unknown event type:", eventType);
                break;
        }
        i += 1 + Number(eventLength);
    }
    */
}

export default service;
