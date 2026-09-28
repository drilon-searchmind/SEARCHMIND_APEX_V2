/**
 * Test LinkedIn Marketing API credentials and export every ad account
 * the token can access.
 *
 * Run from repo root:
 *   node scripts/temp/list-linkedin-ad-accounts.mjs
 *
 * Required in .env:
 *   LI_ACCESS_TOKEN
 *   LI_REFRESH_TOKEN
 *   LI_CLIENT_ID
 *   LI_CLIENT_SECRET
 *
 * Writes scripts/temp/linkedin-ad-accounts.json
 * Docs: https://learn.microsoft.com/en-us/linkedin/marketing/integrations/ads/account-structure/create-and-manage-account-users
 */

import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_ROOT = "https://api.linkedin.com";
const PAGE_SIZE = 100;
const ACCOUNT_FETCH_CONCURRENCY = 8;
const VERSION_CANDIDATES = ["202609", "202608", "202607", "202606", "202605"];

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(scriptDir, "linkedin-ad-accounts.json");

const env = {
    accessToken: process.env.LI_ACCESS_TOKEN?.trim() || "",
    refreshToken: process.env.LI_REFRESH_TOKEN?.trim() || "",
    clientId: process.env.LI_CLIENT_ID?.trim() || "",
    clientSecret: process.env.LI_CLIENT_SECRET?.trim() || "",
};

function requireEnv() {
    const missing = [];
    if (!env.accessToken) missing.push("LI_ACCESS_TOKEN");
    if (!env.refreshToken) missing.push("LI_REFRESH_TOKEN");
    if (!env.clientId) missing.push("LI_CLIENT_ID");
    if (!env.clientSecret) missing.push("LI_CLIENT_SECRET");
    if (missing.length) {
        console.error(`Missing in .env: ${missing.join(", ")}`);
        process.exit(1);
    }
}

function accountIdFromUrn(urn) {
    const match = String(urn || "").match(/sponsoredAccount:(\d+)/);
    return match ? match[1] : "";
}

async function readJson(response) {
    const text = await response.text();
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch {
        return { message: text.slice(0, 500) };
    }
}

function isVersionError(status, body) {
    const code = String(body?.code || body?.serviceErrorCode || "");
    const message = String(body?.message || "");
    return status === 426 || /version/i.test(code) || /nonexistent version|unsupported version/i.test(message);
}

async function refreshAccessToken() {
    const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: env.refreshToken,
        client_id: env.clientId,
        client_secret: env.clientSecret,
    });
    const response = await fetch(`${API_ROOT}/oauth/v2/accessToken`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
    });
    const payload = await readJson(response);
    if (!response.ok || !payload.access_token) {
        const message = payload.error_description || payload.message || payload.error || response.statusText;
        throw new Error(`Token refresh failed (${response.status}): ${message}`);
    }
    env.accessToken = payload.access_token;
    if (payload.refresh_token) env.refreshToken = payload.refresh_token;
    return {
        refreshed: true,
        expiresIn: payload.expires_in ?? null,
        scope: payload.scope || null,
    };
}

async function linkedinGet(url, version) {
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${env.accessToken}`,
            "X-Restli-Protocol-Version": "2.0.0",
            "LinkedIn-Version": version,
        },
    });
    const payload = await readJson(response);
    return { response, payload };
}

async function linkedinGetWithRefresh(url, version, state) {
    let result = await linkedinGet(url, version);
    if (result.response.status === 401 && !state.didRefresh) {
        console.log("Access token rejected. Refreshing with LI_REFRESH_TOKEN…");
        state.refresh = await refreshAccessToken();
        state.didRefresh = true;
        result = await linkedinGet(url, version);
    }
    return result;
}

async function pickVersion(state) {
    let lastError = null;
    for (const version of VERSION_CANDIDATES) {
        const url = `${API_ROOT}/rest/adAccountUsers?q=authenticatedUser&start=0&count=1`;
        const { response, payload } = await linkedinGetWithRefresh(url, version, state);
        if (response.ok) return version;
        if (isVersionError(response.status, payload)) {
            lastError = `${version}: ${payload.message || payload.code || response.status}`;
            continue;
        }
        const message = payload.message || payload.error_description || JSON.stringify(payload);
        throw new Error(`LinkedIn adAccountUsers failed (${response.status}) on version ${version}: ${message}`);
    }
    throw new Error(`No supported LinkedIn-Version worked. Last error: ${lastError}`);
}

async function fetchAuthenticatedUser() {
    const response = await fetch(`${API_ROOT}/v2/userinfo`, {
        headers: { Authorization: `Bearer ${env.accessToken}` },
    });
    const payload = await readJson(response);
    if (!response.ok) {
        return {
            ok: false,
            status: response.status,
            error: payload.message || payload.error_description || payload.error || "userinfo failed",
        };
    }
    return {
        ok: true,
        sub: payload.sub || null,
        name: payload.name || null,
        email: payload.email || null,
    };
}

async function listAllPages(buildUrl, version, state) {
    const elements = [];
    let start = 0;
    let total = null;

    for (let page = 0; page < 200; page += 1) {
        const url = buildUrl(start, PAGE_SIZE);
        const { response, payload } = await linkedinGetWithRefresh(url, version, state);
        if (!response.ok) {
            const message = payload.message || payload.error_description || JSON.stringify(payload);
            throw new Error(`LinkedIn list failed (${response.status}): ${message}`);
        }
        const batch = Array.isArray(payload.elements) ? payload.elements : [];
        elements.push(...batch);
        if (Number.isFinite(payload.paging?.total)) total = payload.paging.total;
        if (!batch.length) break;
        start += batch.length;
        if (total != null && start >= total) break;
        if (batch.length < PAGE_SIZE) break;
    }

    return elements;
}

async function listAccountAccess(version, state) {
    return listAllPages(
        (start, count) =>
            `${API_ROOT}/rest/adAccountUsers?q=authenticatedUser&start=${start}&count=${count}`,
        version,
        state
    );
}

async function listAdAccountsBySearch(version, state) {
    return listAllPages(
        (start, count) => `${API_ROOT}/rest/adAccounts?q=search&start=${start}&count=${count}`,
        version,
        state
    );
}

async function mapPool(items, concurrency, mapper) {
    const results = new Array(items.length);
    let index = 0;
    async function worker() {
        while (index < items.length) {
            const current = index;
            index += 1;
            results[current] = await mapper(items[current], current);
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
    return results;
}

async function fetchAccountDetails(ids, version, state) {
    const details = new Map();
    await mapPool(ids, ACCOUNT_FETCH_CONCURRENCY, async (id) => {
        const { response, payload } = await linkedinGetWithRefresh(
            `${API_ROOT}/rest/adAccounts/${id}`,
            version,
            state
        );
        if (!response.ok) {
            details.set(id, {
                id,
                error: payload.message || `HTTP ${response.status}`,
            });
            return;
        }
        details.set(String(payload.id || id), payload);
    });
    return details;
}

function summarizeAccount(access, account) {
    const urn = access?.account || (account?.id ? `urn:li:sponsoredAccount:${account.id}` : null);
    const id = accountIdFromUrn(urn) || String(account?.id || "");
    return {
        id,
        urn,
        name: account?.name || null,
        status: account?.status || null,
        currency: account?.currency || null,
        type: account?.type || null,
        reference: account?.reference || null,
        test: account?.test ?? null,
        servingStatuses: account?.servingStatuses || [],
        role: access?.role || null,
        user: access?.user || null,
        account: account || null,
        access: access || null,
    };
}

async function main() {
    requireEnv();
    const state = { didRefresh: false, refresh: null };

    console.log("Checking LinkedIn token…");
    const version = await pickVersion(state);
    console.log(`Using LinkedIn-Version ${version}`);

    const authenticatedUser = await fetchAuthenticatedUser();
    if (authenticatedUser.ok) {
        console.log(`Authenticated as ${authenticatedUser.name || authenticatedUser.sub || "unknown user"}`);
    } else {
        console.log(`userinfo not available (${authenticatedUser.status}). Continuing with ad accounts.`);
    }

    console.log("Listing ad account access…");
    const accessRows = await listAccountAccess(version, state);
    console.log(`adAccountUsers returned ${accessRows.length} row(s)`);

    let searchAccounts = [];
    try {
        searchAccounts = await listAdAccountsBySearch(version, state);
        console.log(`adAccounts search returned ${searchAccounts.length} account(s)`);
    } catch (error) {
        console.log(`adAccounts search skipped: ${error.message}`);
    }

    const ids = new Set();
    for (const row of accessRows) {
        const id = accountIdFromUrn(row.account);
        if (id) ids.add(id);
    }
    for (const account of searchAccounts) {
        if (account?.id != null) ids.add(String(account.id));
    }

    const known = new Map(searchAccounts.filter((account) => account?.id != null).map((account) => [String(account.id), account]));
    const missingIds = [...ids].filter((id) => !known.has(id));
    if (missingIds.length) {
        console.log(`Fetching details for ${missingIds.length} account(s)…`);
        const fetched = await fetchAccountDetails(missingIds, version, state);
        for (const [id, account] of fetched) known.set(id, account);
    }

    const accessById = new Map();
    for (const row of accessRows) {
        const id = accountIdFromUrn(row.account);
        if (id) accessById.set(id, row);
    }

    const accounts = [...ids]
        .map((id) => summarizeAccount(accessById.get(id), known.get(id)))
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

    const output = {
        fetchedAt: new Date().toISOString(),
        linkedinVersion: version,
        accessTokenRefreshed: state.didRefresh,
        refreshExpiresIn: state.refresh?.expiresIn ?? null,
        authenticatedUser,
        accountCount: accounts.length,
        accounts,
    };

    await mkdir(scriptDir, { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

    console.log(`Wrote ${accounts.length} account(s) to ${outputPath}`);
    for (const account of accounts) {
        console.log(`  ${account.id}  ${account.name || "(no name)"}  ${account.status || ""}  ${account.role || ""}`.trimEnd());
    }
}

main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
});
