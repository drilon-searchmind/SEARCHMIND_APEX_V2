/**
 * One-time helper: obtain a Microsoft Advertising API refresh token (OAuth 2.0).
 * Run: node scripts/get-microsoft-ads-refresh-token.js
 *
 * Prerequisites in `.env`:
 * - MICROSOFT_ADVERTISING_CLIENT_ID — Azure App Registration → Application (client) ID
 * - MICROSOFT_ADVERTISING_CLIENT_SECRET — App registration → Client secret
 * - MICROSOFT_ADVERTISING_TENANT_ID — **Required for single-tenant apps** (see AADSTS50194). Use your
 *   Directory (tenant) ID: Azure Portal → Microsoft Entra ID → Overview → Tenant ID (GUID).
 *   Omit or use `common` only if the app registration is configured as multi-tenant.
 *
 * Azure Portal → App registration → Authentication → Web:
 * - Add a Redirect URI that matches **exactly** (character-for-character) the value below.
 * - Default is http://localhost:3333/callback (port 3333 avoids clashing with `next dev` on 3000).
 * - Override with MICROSOFT_ADVERTISING_REDIRECT_URI in .env if needed (same value must be in Azure).
 *
 * API permissions: Microsoft Advertising uses delegated consent via scope at token time
 * (no Azure API permission list required for the ads scope in all setups; use the consent screen).
 *
 * Add to `.env` after success:
 * MICROSOFT_ADVERTISING_REFRESH_TOKEN=<printed value>
 *
 * You still need MICROSOFT_ADVERTISING_DEVELOPER_TOKEN from Microsoft Advertising
 * (Tools → API → Request developer token).
 */

import "dotenv/config";
import http from "http";

const CLIENT_ID = process.env.MICROSOFT_ADVERTISING_CLIENT_ID;
const CLIENT_SECRET = process.env.MICROSOFT_ADVERTISING_CLIENT_SECRET;
const TENANT = process.env.MICROSOFT_ADVERTISING_TENANT_ID?.trim() || "common";
/** Must match Azure exactly — default port 3333 so Next.js can keep using 3000. */
const REDIRECT_URI = process.env.MICROSOFT_ADVERTISING_REDIRECT_URI?.trim() || "http://localhost:3333/callback";
const SCOPE = "https://ads.microsoft.com/msads.manage offline_access";

let redirectListen;
try {
    redirectListen = new URL(REDIRECT_URI);
} catch {
    console.error("Invalid MICROSOFT_ADVERTISING_REDIRECT_URI — must be a full URL, e.g. http://localhost:3333/callback");
    process.exit(1);
}
const listenPort = redirectListen.port ? Number(redirectListen.port) : redirectListen.protocol === "https:" ? 443 : 80;
const listenHost = redirectListen.hostname || "localhost";

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error("Missing MICROSOFT_ADVERTISING_CLIENT_ID or MICROSOFT_ADVERTISING_CLIENT_SECRET in .env");
    process.exit(1);
}

if (TENANT === "common") {
    console.warn(
        "\n[!] OAuth tenant is \"common\". Single-tenant app registrations fail with AADSTS50194 unless the app is multi-tenant.\n" +
            "    Fix: add MICROSOFT_ADVERTISING_TENANT_ID=<your-tenant-guid> to .env (Entra ID → Overview → Tenant ID).\n"
    );
}

const authUrl =
    `https://login.microsoftonline.com/${encodeURIComponent(TENANT)}/oauth2/v2.0/authorize?` +
    `client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(SCOPE)}` +
    `&response_mode=query` +
    `&prompt=consent`;

console.log("\n0. In Azure Portal → App registrations → your app → Authentication → Web → Redirect URIs, add EXACTLY:\n");
console.log("   ", REDIRECT_URI);
console.log("\n1. Open this URL in your browser (sign in with the Microsoft Advertising user):\n");
console.log(authUrl);
console.log("\n2. After consent, the browser hits the redirect URI above — this script listens there and captures the code.\n");

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `${redirectListen.protocol}//${listenHost}:${listenPort}`);
    if (url.pathname === "/callback") {
        const code = url.searchParams.get("code");
        const err = url.searchParams.get("error");
        res.writeHead(200, { "Content-Type": "text/html" });
        if (err) {
            res.end(`<html><body><p>Error: ${err}</p></body></html>`);
            server.close();
            console.error("OAuth error:", err, url.searchParams.get("error_description"));
            return;
        }
        if (code) {
            res.end(`<html><body style="font-family:sans-serif;padding:2rem;"><h2>Success</h2><p>Check the terminal for MICROSOFT_ADVERTISING_REFRESH_TOKEN.</p></body></html>`);
            server.close();
            try {
                const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(TENANT)}/oauth2/v2.0/token`;
                const body = new URLSearchParams({
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    code,
                    redirect_uri: REDIRECT_URI,
                    grant_type: "authorization_code",
                    scope: SCOPE,
                });
                const tokenRes = await fetch(tokenUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body,
                });
                const token = await tokenRes.json();
                if (!tokenRes.ok) {
                    console.error("Token exchange failed:", token);
                    return;
                }
                if (token.refresh_token) {
                    console.log("\n--- Add to .env ---\n");
                    console.log(`MICROSOFT_ADVERTISING_REFRESH_TOKEN=${token.refresh_token}`);
                    console.log("\n");
                } else {
                    console.error("No refresh_token in response:", token);
                }
            } catch (e) {
                console.error(e);
            }
        } else {
            res.end("<html><body><p>No code in callback.</p></body></html>");
            server.close();
        }
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(listenPort, listenHost, () => {
    console.log(`Listening for OAuth callback on ${REDIRECT_URI} (host ${listenHost}, port ${listenPort}) …\n`);
});
