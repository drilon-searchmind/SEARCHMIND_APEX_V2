/**
 * MCP apex proxy: route normalization + date params (call_apex_api).
 * Run: node scripts/test/test-mcp-apex-proxy-route.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

import { parseMcpDateRange } from "../../lib/mcpApiHelpers.js";
import {
    apexProxyQueryParamsFromRoute,
    normalizeApexProxyRoutePath,
} from "../../lib/mcpProxyRouteParse.js";

test("normalizeApexProxyRoutePath strips query string for allowlist", () => {
    const route = "/api/ga4-report?startDate=2026-09-01&endDate=2026-09-30";
    const pathname = normalizeApexProxyRoutePath(route);
    assert.equal(pathname, "/api/ga4-report");
    assert.equal(normalizeApexProxyRoutePath("/api/ga4-channels"), "/api/ga4-channels");
});

test("apexProxyQueryParamsFromRoute extracts query for merge with params", () => {
    const fromRoute = apexProxyQueryParamsFromRoute(
        "/api/ga4-channels?startDate=2026-09-01&endDate=2026-09-30"
    );
    const range = parseMcpDateRange({
        ...fromRoute,
        startDate: "2026-09-01",
        endDate: "2026-09-30",
    });
    assert.equal(range.startDate, "2026-09-01");
    assert.equal(range.endDate, "2026-09-30");
});

test("parseMcpDateRange accepts params record (call_apex_api GA4 handlers)", () => {
    const range = parseMcpDateRange({
        startDate: "2026-09-01",
        endDate: "2026-09-30",
    });
    assert.equal(range.startDate, "2026-09-01");
    assert.equal(range.endDate, "2026-09-30");
});
