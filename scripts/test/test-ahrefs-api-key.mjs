/**
 * Verify AHREFS_API_KEY against Ahrefs API v3 (free test query — no units consumed).
 *
 * Run from repo root:
 *   node scripts/test/test-ahrefs-api-key.mjs
 *
 * Required in .env:
 *   AHREFS_API_KEY=your-api-key
 *
 * Docs: https://docs.ahrefs.com/api/docs/free-test-queries
 */

import "dotenv/config";

const API_BASE = "https://api.ahrefs.com/v3";
/** Free test target — does not consume API units */
const FREE_TEST_TARGET = "wordcount.com";

const apiKey = process.env.AHREFS_API_KEY?.trim();

if (!apiKey) {
  console.error("Missing AHREFS_API_KEY in .env");
  process.exit(1);
}

/** Ahrefs site-explorer endpoints expect a date (YYYY-MM-DD). */
function yesterdayIsoDate() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

const date = process.env.AHREFS_TEST_DATE?.trim() || yesterdayIsoDate();
const url = new URL(`${API_BASE}/site-explorer/domain-rating`);
url.searchParams.set("target", FREE_TEST_TARGET);
url.searchParams.set("date", date);

console.log("Testing Ahrefs API key…");
console.log("  Endpoint:", url.pathname);
console.log("  Target:  ", FREE_TEST_TARGET, "(free test — no units charged)");
console.log("  Date:    ", date);

const res = await fetch(url, {
  headers: {
    Accept: "application/json",
    Authorization: `Bearer ${apiKey}`,
  },
});

const text = await res.text();
let data;
try {
  data = text ? JSON.parse(text) : {};
} catch {
  data = { raw: text };
}

if (!res.ok) {
  console.error("\nAhrefs API key test FAILED");
  console.error("  HTTP status:", res.status, res.statusText);
  if (data?.error || data?.message) {
    console.error("  Message:", data.error || data.message);
  }
  console.error("  Response:", JSON.stringify(data, null, 2));
  process.exit(1);
}

console.log("\nAhrefs API key is valid.");
console.log("  HTTP status:", res.status);
console.log("  Response:", JSON.stringify(data, null, 2));
