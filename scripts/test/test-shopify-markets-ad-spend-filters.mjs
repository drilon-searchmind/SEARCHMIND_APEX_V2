/**
 * Run: node scripts/test/test-shopify-markets-ad-spend-filters.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
    resolveGoogleCountryFilterForMergedSources,
    resolveMetaCountryFilterForMergedSources,
} from "../../src/lib/shopifyMarketsAdSpendFilters.js";

test("Shopify Markets all-markets rollup ignores legacy customerMetaID", () => {
    const meta = resolveMetaCountryFilterForMergedSources(
        {
            shopifyMarketsEnabled: true,
            customerMetaID: "DK",
            customerMetaIDExclude: "SE",
        },
        null
    );
    assert.equal(meta.include, "");
    assert.equal(meta.exclude, "");
});

test("Shopify Markets uses market-resolved codes when filtering ad spend", () => {
    const meta = resolveMetaCountryFilterForMergedSources(
        { shopifyMarketsEnabled: true, customerMetaID: "DK" },
        { metaCountryCodes: ["dk", "de"] }
    );
    assert.equal(meta.include, "DK,DE");
    assert.equal(meta.exclude, "");
});

test("non–Shopify Markets keeps legacy Meta ID filters", () => {
    const meta = resolveMetaCountryFilterForMergedSources(
        {
            shopifyMarketsEnabled: false,
            customerMetaID: "DK,NO",
            customerMetaIDExclude: "SE",
        },
        null
    );
    assert.equal(meta.include, "DK,NO");
    assert.equal(meta.exclude, "SE");
});

test("Google: Shopify Markets all-markets skips legacy country filter", () => {
    const g = resolveGoogleCountryFilterForMergedSources(
        {
            shopifyMarketsEnabled: true,
            googleAdsCountryFilter: "Denmark",
        },
        null
    );
    assert.equal(g.include, undefined);
    assert.equal(g.exclude, undefined);
});
