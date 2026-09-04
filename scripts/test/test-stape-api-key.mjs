/**
 * Quick Stape Partner Tracking Checker API smoke test.
 * Usage: node scripts/test/test-stape-api-key.mjs
 */
import dotenv from "dotenv";

dotenv.config();

const key = String(process.env.STAPE_API_KEY || "").trim();
const configuredBase = String(process.env.STAPE_API_BASE || "").trim();
const candidateBases = [
    ...(configuredBase ? [configuredBase.replace(/\/$/, "")] : []),
    "https://api.app.stape.io",
    "https://api.app.eu.stape.io",
].filter((base, index, arr) => arr.indexOf(base) === index);

function formatStapeApiError(json, text, status) {
    if (json && typeof json === "object") {
        const nested = json.error;
        if (nested && typeof nested === "object") {
            return nested.message || nested.description || JSON.stringify(nested);
        }
        if (typeof nested === "string" && nested.trim()) return nested;
        if (json.body?.message) return String(json.body.message);
        if (typeof json.message === "string") return json.message;
    }
    return text?.trim() || `Stape API error (${status})`;
}

async function main() {
    if (!key) {
        console.error("STAPE_API_KEY is not set in .env");
        process.exit(1);
    }

    let base = candidateBases[0];
    let limitJson = null;

    for (const candidate of candidateBases) {
        console.log(`Testing Stape API at ${candidate} …`);
        const limitRes = await fetch(`${candidate}/api/v2/partner-tracking-checker/limit`, {
            headers: { accept: "application/json", "X-AUTH-TOKEN": key },
        });
        const limitText = await limitRes.text();
        try {
            limitJson = limitText ? JSON.parse(limitText) : null;
        } catch {
            limitJson = null;
        }

        if (limitRes.ok) {
            base = candidate;
            console.log("OK limit:", limitJson);
            if (!configuredBase && candidate !== "https://api.app.stape.io") {
                console.log(`Tip: add STAPE_API_BASE=${candidate} to .env and Vercel`);
            }
            break;
        }

        console.error("FAIL limit:", formatStapeApiError(limitJson, limitText, limitRes.status));
        if (candidate === candidateBases[candidateBases.length - 1]) {
            process.exit(1);
        }
    }

    const callbackUrl = "https://example.com/webhook-test";
    const postRes = await fetch(`${base}/api/v2/partner-tracking-checker`, {
        method: "POST",
        headers: {
            accept: "application/json",
            "Content-Type": "application/json",
            "X-AUTH-TOKEN": key,
        },
        body: JSON.stringify({
            siteUrl: "https://example.com",
            callbackUrl,
        }),
    });
    const postText = await postRes.text();
    let postJson = null;
    try {
        postJson = postText ? JSON.parse(postText) : null;
    } catch {
        postJson = null;
    }

    if (!postRes.ok) {
        console.error("FAIL start scan:", formatStapeApiError(postJson, postText, postRes.status));
        process.exit(1);
    }

    console.log("OK start scan:", postJson);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
