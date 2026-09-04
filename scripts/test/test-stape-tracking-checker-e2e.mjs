/**
 * Full Stape E2E: creates Mongo job, calls Stape EU, waits for webhook.
 * Usage: node scripts/test/test-stape-tracking-checker-e2e.mjs [siteUrl]
 */
import dotenv from "dotenv";
import crypto from "crypto";
import mongoose from "mongoose";
import connectToDatabase from "../../lib/mongodb.js";
import StapeTrackingCheckerJob from "../../src/models/StapeTrackingCheckerJob.js";

dotenv.config();

const siteUrl = process.argv[2] || "https://example.com";
const STALE_MS = 3 * 60 * 1000;

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function getApexPublicBaseUrl() {
    const candidates = [
        process.env.APEX_PUBLIC_URL,
        process.env.VERCEL_PROJECT_PRODUCTION_URL
            ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
            : "",
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
        process.env.NEXTAUTH_URL,
        "https://apex.searchmind.tech",
    ];
    for (const raw of candidates) {
        const base = String(raw || "").trim().replace(/\/$/, "");
        if (!base) continue;
        try {
            const url = new URL(/^https?:\/\//i.test(base) ? base : `https://${base}`);
            if (url.hostname === "localhost" || url.hostname === "127.0.0.1") continue;
            return url.origin;
        } catch {
            continue;
        }
    }
    return "https://apex.searchmind.tech";
}

function getStapeApiBase() {
    return String(process.env.STAPE_API_BASE || "https://api.app.eu.stape.io").replace(/\/$/, "");
}

function getStapeRegionQuery() {
    const base = getStapeApiBase();
    if (base.includes(".eu.")) return "";
    const region = String(process.env.STAPE_REGION || "").trim().toUpperCase();
    return region ? `?region=${encodeURIComponent(region)}` : "";
}

async function probeWebhook(callbackUrl) {
    for (const method of ["GET", "HEAD"]) {
        const r = await fetch(callbackUrl, { method });
        const text = method === "HEAD" ? "" : await r.text();
        console.log(`  ${method} ${r.status}`, text.slice(0, 100));
    }
}

async function main() {
    const stapeKey = String(process.env.STAPE_API_KEY || "").trim();
    if (!stapeKey) {
        console.error("STAPE_API_KEY missing");
        process.exit(1);
    }

    await connectToDatabase();

    const apexBase = getApexPublicBaseUrl();
    const webhookToken = crypto.randomBytes(24).toString("hex");
    const jobIdObj = new mongoose.Types.ObjectId();
    const jobId = String(jobIdObj);
    const callbackUrl = `${apexBase}/api/webhooks/stape/tracking-checker/${jobId}?token=${encodeURIComponent(webhookToken)}`;

    console.log("APEX base:", apexBase);
    console.log("Stape base:", getStapeApiBase(), getStapeRegionQuery() || "(no region param)");
    console.log("Site:", siteUrl);
    console.log("Callback:", callbackUrl);
    console.log("Probing webhook URL…");
    await probeWebhook(callbackUrl);

    await StapeTrackingCheckerJob.create({
        _id: jobIdObj,
        siteUrl: new URL(/^https?:\/\//i.test(siteUrl) ? siteUrl : `https://${siteUrl}`).origin,
        status: "pending",
        requestedBy: "e2e-test@searchmind.dk",
        webhookToken,
        callbackUrl,
    });

    const startUrl = `${getStapeApiBase()}/api/v2/partner-tracking-checker${getStapeRegionQuery()}`;
    const startRes = await fetch(startUrl, {
        method: "POST",
        headers: {
            accept: "application/json",
            "Content-Type": "application/json",
            "X-AUTH-TOKEN": stapeKey,
        },
        body: JSON.stringify({ siteUrl, callbackUrl }),
    });
    const startText = await startRes.text();
    console.log("Stape start:", startRes.status, startText);

    if (!startRes.ok) {
        process.exit(1);
    }

    let stapeResponse = null;
    try {
        stapeResponse = JSON.parse(startText);
    } catch {
        /* ignore */
    }
    await StapeTrackingCheckerJob.updateOne({ _id: jobIdObj }, { $set: { stapeResponse } });

    const identifier = stapeResponse?.body?.identifier;
    console.log("Stape identifier:", identifier);
    console.log("Waiting up to 180s for Stape webhook…");

    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
        const doc = await StapeTrackingCheckerJob.findById(jobIdObj).lean();
        if (doc.status !== "pending") {
            console.log("DONE:", JSON.stringify(doc, null, 2));
            process.exit(doc.status === "complete" ? 0 : 1);
        }
        const age = Date.now() - new Date(doc.createdAt).getTime();
        if (age > STALE_MS) {
            console.log(`Still pending after ${Math.round(age / 1000)}s (stale threshold ${STALE_MS / 1000}s)`);
        }
        await sleep(5000);
    }

    const finalDoc = await StapeTrackingCheckerJob.findById(jobIdObj).lean();
    console.log("TIMEOUT — final:", JSON.stringify(finalDoc, null, 2));
    process.exit(2);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
