"use client";

/**
 * SEO dashboard parts. Generic pieces (formatters, change chip, KPI card, donut, tag) live in
 * the shared service parts; only SEO specifics are defined here.
 */

export {
    num,
    isNum,
    fmtInt,
    fmtKr,
    fmtDec,
    fmtPctPoints,
    fmtShare,
    compact,
    vsCaption,
    DeltaChip,
    ServiceKpi as SeoKpi,
    ServiceDonut as SeoDonut,
    ServiceTag as SeoTag,
} from "@/components/dashboard/ServiceParts";

/** Brand vs non-brand and other two-series splits (DESIGN.md: distinct non-brand hues). */
export const SEO_COLORS = {
    nonBrand: "#2563EB",
    brand: "#EA580C",
    spend: "#121A13",
};
