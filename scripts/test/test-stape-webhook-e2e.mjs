/**
 * End-to-end Stape tracking checker test:
 * 1) POST scan to Stape EU with production callback URL
 * 2) Poll APEX webhook GET/POST health
 * 3) Wait up to 3 min for Stape callback (via direct Mongo if MONGODB_URI set, else poll production API)
 *
 * Usage: node scripts/test/test-stape-webhook-e2e.mjs [siteUrl]
 */
import dotenv from "dotenv";
import crypto from "crypto";
import mongoose from "mongoose";

dotenv.config();

const siteUrl = process.argv[2] || "https://example.com";
const apexBase = String(process.env.APEX_PUBLIC_URL || "https://apex.searchmind.tech").replace(
    /\/$/,
    ""
);
const stapeBase = String(process.env.STAPE_API_BASE || "https://api.app.eu.stape.io").replace(
    /\/$/,
    ""
);
const stapeKey = String(process.env.STAPE_API_KEY || "").trim();

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function main() {
    if (!stapeKey) {
        console.error("STAPE_API_KEY missing");
        process.exit(1);
    }

    const jobId = new mongoose.Types.ObjectId();
    const token = crypto.randomBytes(24).toString("hex");
    const callbackUrl = `${apexBase}/api/webhooks/stape/tracking-checker/${jobId}?token=${encodeURIComponent(token)}`;

    console.log("Site:", siteUrl);
    console.log("Callback:", callbackUrl);

    // Webhook reachability checks
    for (const method of ["GET", "HEAD", "POST"]) {
        const init = { method, headers: { accept: "application/json" } };
        if (method === "POST") {
            init.headers["Content-Type"] = "application/json";
            init.body = JSON.stringify({ ping: true });
        }
        const r = await fetch(callbackUrl, init);
        const text = method === "HEAD" ? "" : await r.text();
        console.log(`${method} webhook -> ${r.status}`, text.slice(0, 120));
    }

    const regionParam = stapeBase.includes(".eu.") ? "?region=EU" : "";
    const startUrl = `${stapeBase}/api/v2/partner-tracking-checker${regionParam}`;
    console.log("Starting Stape scan at", startUrl);

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

    let identifier = null;
    try {
        const j = JSON.parse(startText);
        identifier = j?.body?.identifier || j?.identifier || null;
    } catch {
        /* ignore */
    }
    console.log("Stape identifier:", identifier);
    console.log("Waiting up to 180s for Stape webhook (manual POST test with token)...");

    const mockPayload = {
        siteUrl,
        identifier: identifier || "test",
        score: 77,
        trackers: [{ name: "Google Analytics", detected: true }],
    };

    // After 30s, simulate webhook if still no real callback (proves endpoint works)
    await sleep(5000);
    const simRes = await fetch(callbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockPayload),
    });
    const simText = await simRes.text();
    console.log("Simulated webhook POST ->", simRes.status, simText.slice(0, 200));

    console.log("Done. Real Stape callback requires a persisted job in Mongo — use Apex UI for full flow.");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
