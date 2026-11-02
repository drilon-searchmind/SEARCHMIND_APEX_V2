/**
 * One-time script to get a new Google Ads refresh token.
 * Run: node scripts/get-google-ads-refresh-token.js
 *
 * Prerequisites:
 * - SSO_GOOGLE_CLIENT_ID and SSO_GOOGLE_CLIENT_SECRET in .env (or legacy GOOGLE_ADS_*)
 * - In Google Cloud Console → APIs & Services → Credentials → your OAuth client:
 *   Add the redirect URI printed below (default http://localhost:8765/callback)
 *   Must match character-for-character (http vs https, port, path).
 *
 * Optional env:
 * - GOOGLE_ADS_OAUTH_PORT (default 8765) — avoids clashing with `next dev` on 3000
 * - GOOGLE_ADS_OAUTH_REDIRECT_URI — override full redirect URI
 *
 * Steps:
 * 1. Add redirect URI in Google Cloud, then run this script
 * 2. Open the printed URL in your browser
 * 3. Sign in with the Google account that has access to your Google Ads MCC
 * 4. Grant access – you'll be redirected and the script will capture the token
 * 5. Copy the refresh_token from the terminal and add to .env as GOOGLE_ADS_REFRESH_TOKEN
 */

import "dotenv/config";
import http from "http";

const CLIENT_ID = process.env.SSO_GOOGLE_CLIENT_ID || process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET =
    process.env.SSO_GOOGLE_CLIENT_SECRET || process.env.GOOGLE_ADS_CLIENT_SECRET;
const SCOPE = "https://www.googleapis.com/auth/adwords";
const PORT = Number(process.env.GOOGLE_ADS_OAUTH_PORT || 8765);
const REDIRECT_URI =
    String(process.env.GOOGLE_ADS_OAUTH_REDIRECT_URI || "").trim() ||
    `http://localhost:${PORT}/callback`;

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error(
    "Missing SSO_GOOGLE_CLIENT_ID / SSO_GOOGLE_CLIENT_SECRET (or GOOGLE_ADS_*) in .env"
  );
    process.exit(1);
}

const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(SCOPE)}` +
    `&access_type=offline` +
    `&prompt=consent`;

console.log("\n--- Google Cloud setup (do this first) ---");
console.log("OAuth client → Authorized redirect URIs → add exactly:");
console.log(`  ${REDIRECT_URI}`);
console.log("\n--- Then open this URL (Google Ads / MCC user) ---\n");
console.log(authUrl);
console.log(`\n--- Waiting for redirect on ${REDIRECT_URI} ---\n`);

const server = http.createServer(async (req, res) => {
    const base = new URL(REDIRECT_URI);
    const url = new URL(req.url, base.origin);
    if (url.pathname !== base.pathname) {
        res.writeHead(404);
        res.end("Not found");
        return;
    }
    const code = url.searchParams.get("code");
    const oauthError = url.searchParams.get("error");
    res.writeHead(200, { "Content-Type": "text/html" });
    if (oauthError) {
        res.end(
            `<html><body style="font-family:sans-serif;padding:2rem;"><h2>OAuth error</h2><p>${oauthError}</p></body></html>`
        );
        console.error("OAuth error from Google:", oauthError, url.searchParams.get("error_description") || "");
        server.close();
        process.exit(1);
    }
    if (code) {
        res.end(`
        <html><body style="font-family:sans-serif;padding:2rem;">
          <h2>Success!</h2>
          <p>Check your terminal for the refresh token.</p>
          <p>You can close this tab.</p>
        </body></html>
      `);
        server.close();
        try {
            const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    code,
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    redirect_uri: REDIRECT_URI,
                    grant_type: "authorization_code",
                }),
            });
            const token = await tokenRes.json();
            if (token.refresh_token) {
                console.log("\n--- Your new refresh token ---\n");
                console.log(token.refresh_token);
                console.log("\n--- Add to .env (and Vercel) ---\n");
                console.log(`GOOGLE_ADS_REFRESH_TOKEN=${token.refresh_token}`);
                console.log("\n");
            } else {
                console.error("No refresh_token in response:", token);
            }
        } catch (e) {
            console.error("Error exchanging code:", e);
        }
        process.exit(0);
    } else {
        res.end(`<html><body>Error: no code in URL. Full URL: ${req.url}</body></html>`);
    }
});

server.listen(PORT, () => {
    console.log(`Listening on port ${PORT} …\n`);
});

server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        console.error(
            `Port ${PORT} is in use. Stop the other process or set GOOGLE_ADS_OAUTH_PORT to a free port ` +
                `(and add the matching redirect URI in Google Cloud).`
        );
    } else {
        console.error(err);
    }
    process.exit(1);
});
