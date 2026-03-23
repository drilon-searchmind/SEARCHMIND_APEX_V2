/**
 * One-time script to get a new Google Ads refresh token.
 * Run: node scripts/get-google-ads-refresh-token.js
 *
 * Prerequisites:
 * - GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET in .env
 * - In Google Cloud Console → APIs & Services → Credentials → your OAuth client:
 *   Add "http://localhost:3000/callback" to Authorized redirect URIs
 *
 * Steps:
 * 1. Run this script
 * 2. Open the printed URL in your browser
 * 3. Sign in with the Google account that has access to your Google Ads
 * 4. Grant access – you'll be redirected and the script will capture the token
 * 5. Copy the refresh_token from the terminal and add to .env as GOOGLE_ADS_REFRESH_TOKEN
 */

import "dotenv/config";
import http from "http";

const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const SCOPE = "https://www.googleapis.com/auth/adwords";
const REDIRECT_URI = "http://localhost:3000/callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing GOOGLE_ADS_CLIENT_ID or GOOGLE_ADS_CLIENT_SECRET in .env");
  process.exit(1);
}

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
  `client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPE)}` +
  `&access_type=offline` +
  `&prompt=consent`;

console.log("\n1. Open this URL in your browser (signed in as the Google Ads user):\n");
console.log(authUrl);
console.log("\n2. After granting access, you'll be redirected to localhost:3000");
console.log("   The script will capture the code automatically.\n");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:3000`);
  if (url.pathname === "/callback") {
    const code = url.searchParams.get("code");
    res.writeHead(200, { "Content-Type": "text/html" });
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
          console.log("\n--- Add to .env ---\n");
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
  }
});

server.listen(3000, () => {
  console.log("3. Waiting for redirect on http://localhost:3000/callback ...\n");
});
