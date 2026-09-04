import crypto from "crypto";
import mongoose from "mongoose";
import connectToDatabase from "@root/lib/mongodb";
import { getCustomerById } from "@root/lib/customerOperations";
import StapeTrackingCheckerJob from "@/models/StapeTrackingCheckerJob";

const STAPE_DEFAULT_BASE = "https://api.app.stape.io";
/** EU partner accounts must set STAPE_API_BASE=https://api.app.eu.stape.io */
const PENDING_DEDUPE_MS = 5 * 60 * 1000;
const DEFAULT_POLL_INTERVAL_MS = 2000;
const STALE_PENDING_MS = 3 * 60 * 1000;
const PENDING_TIMEOUT_MS = 10 * 60 * 1000;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getStapeApiKey() {
    const key = String(process.env.STAPE_API_KEY || "").trim();
    if (!key) {
        throw new Error("STAPE_API_KEY is not configured on this deployment.");
    }
    return key;
}

export function getStapeApiBase() {
    return String(process.env.STAPE_API_BASE || STAPE_DEFAULT_BASE).replace(/\/$/, "");
}

export function getApexPublicBaseUrl() {
    /** Prefer explicit public URL; never use localhost for external webhooks. */
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
            if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
                continue;
            }
            return url.origin;
        } catch {
            continue;
        }
    }

    return "https://apex.searchmind.tech";
}

function createWebhookToken() {
    return crypto.randomBytes(24).toString("hex");
}

/**
 * @param {string} raw
 */
export function normalizeStapeSiteUrl(raw) {
    let url = String(raw || "").trim();
    if (!url) {
        throw new Error("siteUrl is required");
    }
    if (!/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
    }
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        throw new Error("Invalid siteUrl");
    }
    if (!parsed.hostname) {
        throw new Error("Invalid siteUrl");
    }
    // Stape scans expect HTTPS; customer config often stores http:// origins.
    if (parsed.protocol === "http:") {
        parsed.protocol = "https:";
    }
    return parsed.origin;
}

/**
 * @param {string} customerId
 */
export async function resolveStapeSiteUrlForCustomer(customerId) {
    const doc = await getCustomerById(customerId);
    if (!doc) {
        throw new Error("Customer not found");
    }
    const settings = doc.CustomerSettings || {};
    const raw =
        settings.shopifyUrl ||
        settings.googleSearchConsoleProperty ||
        settings.bingWebmasterSiteUrl ||
        "";
    if (!String(raw).trim()) {
        throw new Error(
            "No website URL on this customer. Set Shopify URL or Search Console property in Config."
        );
    }
    return {
        siteUrl: normalizeStapeSiteUrl(raw),
        customerName: doc.customerName || "",
    };
}

function extractSummaryFromStapeResult(result) {
    if (!result || typeof result !== "object") return null;
    const root = result.data && typeof result.data === "object" ? result.data : result;
    const summary = {};
    for (const key of [
        "score",
        "trackingScore",
        "totalScore",
        "performanceScore",
        "complianceScore",
        "grade",
        "url",
        "siteUrl",
    ]) {
        if (root[key] != null) summary[key] = root[key];
    }
    if (Array.isArray(root.recommendations)) {
        summary.recommendationCount = root.recommendations.length;
    }
    if (Array.isArray(root.trackers)) {
        summary.trackerCount = root.trackers.length;
    }
    return Object.keys(summary).length ? summary : null;
}

function serializeJob(doc) {
    if (!doc) return null;
    const id = String(doc._id);
    const out = {
        jobId: id,
        status: doc.status,
        siteUrl: doc.siteUrl,
        customerId: doc.customerId ? String(doc.customerId) : null,
        customerName: doc.customerName || "",
        summary: doc.summary || null,
        result: doc.status === "complete" ? doc.result ?? null : undefined,
        error: doc.error || "",
        stapeIdentifier: doc.stapeResponse?.body?.identifier || null,
        createdAt: doc.createdAt,
        completedAt: doc.completedAt || null,
    };

    if (doc.status === "pending" && doc.createdAt) {
        const ageMs = Date.now() - new Date(doc.createdAt).getTime();
        if (ageMs > STALE_PENDING_MS) {
            out.stale = true;
            const callbackHost = (() => {
                try {
                    return doc.callbackUrl ? new URL(doc.callbackUrl).hostname : null;
                } catch {
                    return null;
                }
            })();
            if (callbackHost === "localhost" || callbackHost === "127.0.0.1") {
                out.hint =
                    "Webhook was sent to localhost — Stape cannot reach it. Set APEX_PUBLIC_URL=https://apex.searchmind.tech on Vercel, redeploy, and start a new scan.";
            } else {
                out.hint =
                    "Webhook not received yet. APEX accepts POST callbacks (browser GET returns 405 until deployed). If scans stay pending, Stape may not be firing callbacks — contact Stape support with the stapeIdentifier.";
            }
        }
    }

    return out;
}

function buildCallbackUrl(jobId, webhookToken) {
    return `${getApexPublicBaseUrl()}/api/webhooks/stape/tracking-checker/${jobId}?token=${encodeURIComponent(webhookToken)}`;
}

function formatStapeApiError(json, text, status) {
    if (json && typeof json === "object") {
        const nested = json.error;
        if (nested && typeof nested === "object") {
            return (
                nested.message ||
                nested.description ||
                nested.detail ||
                JSON.stringify(nested)
            );
        }
        if (typeof nested === "string" && nested.trim()) {
            return nested;
        }
        if (json.body && typeof json.body === "object" && json.body.message) {
            return String(json.body.message);
        }
        if (typeof json.message === "string" && json.message.trim()) {
            return json.message;
        }
        if (Array.isArray(json.errors) && json.errors.length) {
            const first = json.errors[0];
            if (typeof first === "string") return first;
            if (first && typeof first === "object") {
                return first.detail || first.message || JSON.stringify(first);
            }
        }
    }
    return text?.trim() || `Stape API error (${status})`;
}

/** Only append ?region= on the global host; EU host already routes correctly. */
function getStapeRegionQuery() {
    const base = getStapeApiBase();
    if (base.includes(".eu.")) return "";
    const region = String(process.env.STAPE_REGION || "").trim().toUpperCase();
    return region ? `?region=${encodeURIComponent(region)}` : "";
}

async function requestStapeScan(siteUrl, callbackUrl) {
    const res = await fetch(
        `${getStapeApiBase()}/api/v2/partner-tracking-checker${getStapeRegionQuery()}`,
        {
        method: "POST",
        headers: {
            accept: "application/json",
            "Content-Type": "application/json",
            "X-AUTH-TOKEN": getStapeApiKey(),
        },
            body: JSON.stringify({ siteUrl, callbackUrl }),
        }
    );

    const text = await res.text();
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        json = null;
    }

    if (!res.ok) {
        throw new Error(formatStapeApiError(json, text, res.status));
    }

    return json;
}

/**
 * @param {{ siteUrl?: string, customerId?: string, requestedBy?: string }} input
 */
export async function startStapeTrackingCheckerJob(input = {}) {
    await connectToDatabase();

    let siteUrl = input.siteUrl ? normalizeStapeSiteUrl(input.siteUrl) : "";
    let customerName = "";
    let customerId = null;

    if (input.customerId) {
        if (!mongoose.Types.ObjectId.isValid(input.customerId)) {
            throw new Error("Invalid customerId");
        }
        const resolved = await resolveStapeSiteUrlForCustomer(input.customerId);
        siteUrl = input.siteUrl ? normalizeStapeSiteUrl(input.siteUrl) : resolved.siteUrl;
        customerName = resolved.customerName;
        customerId = new mongoose.Types.ObjectId(input.customerId);
    }

    if (!siteUrl) {
        throw new Error("siteUrl or customerId is required");
    }

    const pendingSince = new Date(Date.now() - PENDING_DEDUPE_MS);
    const existing = await StapeTrackingCheckerJob.findOne({
        siteUrl,
        status: "pending",
        createdAt: { $gte: pendingSince },
    })
        .sort({ createdAt: -1 })
        .lean();

    if (existing) {
        return { ...serializeJob(existing), reused: true };
    }

    const webhookToken = createWebhookToken();
    const jobIdPlaceholder = new mongoose.Types.ObjectId();
    const jobId = String(jobIdPlaceholder);
    const callbackUrl = buildCallbackUrl(jobId, webhookToken);

    const job = await StapeTrackingCheckerJob.create({
        _id: jobIdPlaceholder,
        siteUrl,
        customerId,
        customerName,
        status: "pending",
        requestedBy: String(input.requestedBy || "").trim(),
        webhookToken,
        callbackUrl,
    });

    try {
        const stapeResponse = await requestStapeScan(siteUrl, callbackUrl);
        await StapeTrackingCheckerJob.updateOne(
            { _id: job._id },
            { $set: { stapeResponse: stapeResponse ?? null } }
        );
    } catch (e) {
        await StapeTrackingCheckerJob.updateOne(
            { _id: job._id },
            {
                $set: {
                    status: "failed",
                    error: e.message || "Failed to start Stape scan",
                    completedAt: new Date(),
                },
            }
        );
        const failed = await StapeTrackingCheckerJob.findById(job._id).lean();
        return serializeJob(failed);
    }

    const saved = await StapeTrackingCheckerJob.findById(job._id).lean();
    return serializeJob(saved);
}

/**
 * @param {string} jobId
 * @param {string} token
 * @param {unknown} payload
 */
export async function completeStapeTrackingCheckerWebhook(jobId, token, payload) {
    await connectToDatabase();
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
        throw new Error("Invalid jobId");
    }

    const job = await StapeTrackingCheckerJob.findById(jobId);
    if (!job) {
        throw new Error("Job not found");
    }

    const expected = String(job.webhookToken || "");
    if (!expected || String(token || "") !== expected) {
        throw new Error("Invalid webhook token");
    }

    if (job.status === "complete" || job.status === "failed") {
        return serializeJob(job.toObject());
    }

    const body =
        payload && typeof payload === "object" && payload.body && typeof payload.body === "object"
            ? payload.body
            : payload;

    const isError =
        body &&
        typeof body === "object" &&
        (body.status === "error" ||
            body.reportStatus === "error" ||
            (body.error && typeof body.error === "string"));

    if (isError) {
        job.status = "failed";
        job.result = payload ?? null;
        job.summary = null;
        job.error =
            (body && (body.message || body.error)) ||
            "Stape reported a scan error";
        job.completedAt = new Date();
        await job.save();
        return serializeJob(job.toObject());
    }

    const summary = extractSummaryFromStapeResult(body);
    job.status = "complete";
    job.result = payload ?? null;
    job.summary = summary;
    job.error = "";
    job.completedAt = new Date();
    await job.save();

    return serializeJob(job.toObject());
}

/**
 * @param {string} jobId
 * @param {{ waitMs?: number }} [options]
 */
export async function getStapeTrackingCheckerJob(jobId, options = {}) {
    await connectToDatabase();
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
        throw new Error("Invalid jobId");
    }

    const waitMs = Math.min(Math.max(Number(options.waitMs) || 0, 0), 130_000);
    const deadline = Date.now() + waitMs;

    do {
        let doc = await StapeTrackingCheckerJob.findById(jobId).lean();
        if (!doc) {
            throw new Error("Job not found");
        }

        if (doc.status === "pending" && doc.createdAt) {
            const ageMs = Date.now() - new Date(doc.createdAt).getTime();
            if (ageMs > PENDING_TIMEOUT_MS) {
                await StapeTrackingCheckerJob.updateOne(
                    { _id: doc._id, status: "pending" },
                    {
                        $set: {
                            status: "failed",
                            error:
                                "Timed out waiting for Stape webhook (10 minutes). Start a new scan after verifying APEX_PUBLIC_URL on Vercel.",
                            completedAt: new Date(),
                        },
                    }
                );
                doc = await StapeTrackingCheckerJob.findById(jobId).lean();
            }
        }

        if (doc.status !== "pending" || waitMs <= 0) {
            return serializeJob(doc);
        }
        if (Date.now() >= deadline) {
            return serializeJob(doc);
        }
        await sleep(DEFAULT_POLL_INTERVAL_MS);
    } while (true);
}

export async function fetchStapeTrackingCheckerLimit() {
    const res = await fetch(
        `${getStapeApiBase()}/api/v2/partner-tracking-checker/limit${getStapeRegionQuery()}`,
        {
        method: "GET",
        headers: {
            accept: "application/json",
            "X-AUTH-TOKEN": getStapeApiKey(),
        },
            cache: "no-store",
        }
    );

    const text = await res.text();
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        json = null;
    }

    if (!res.ok) {
        throw new Error(formatStapeApiError(json, text, res.status));
    }

    return json;
}
