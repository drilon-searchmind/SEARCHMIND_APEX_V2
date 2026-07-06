/**
 * Manually trigger Apex Radar Slack cron against local or production.
 *
 * Usage:
 *   npm run apex-radar:cron
 *   npm run apex-radar:cron -- facebook
 *   npm run apex-radar:cron -- google-ads
 *
 * Env: CRON_SECRET (required), APEX_RADAR_CRON_URL (default http://localhost:3000)
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const secret = (process.env.CRON_SECRET || "").trim();
const baseUrl = (process.env.APEX_RADAR_CRON_URL || "http://localhost:3000").replace(/\/$/, "");
const channels = process.argv[2] || "all";

if (!secret) {
    console.error("Missing CRON_SECRET in .env");
    process.exit(1);
}

const url = `${baseUrl}/api/cron/apex-radar-slack?channels=${encodeURIComponent(channels)}`;

const res = await fetch(url, {
    method: "GET",
    headers: {
        Authorization: `Bearer ${secret}`,
    },
});

const data = await res.json().catch(() => ({}));

if (!res.ok) {
    console.error(`HTTP ${res.status}`, data);
    process.exit(1);
}

console.log(JSON.stringify(data, null, 2));
