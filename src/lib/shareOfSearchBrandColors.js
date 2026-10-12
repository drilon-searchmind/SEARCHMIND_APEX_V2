/** Distinct hues for Share of Search brands (not shared gray scale). */
const BRAND_PALETTE = [
	"#2563eb",
	"#dc2626",
	"#16a34a",
	"#9333ea",
	"#ea580c",
	"#0891b2",
	"#ca8a04",
	"#db2777",
	"#4f46e5",
	"#0d9488",
	"#b45309",
	"#7c3aed",
	"#059669",
	"#e11d48",
	"#0284c7",
	"#65a30d",
	"#c026d3",
	"#d97706",
	"#6366f1",
	"#14b8a6",
];

/**
 * @param {number} index
 */
export function shareOfSearchBrandColor(index) {
	const i = Number(index);
	if (!Number.isFinite(i) || i < 0) return BRAND_PALETTE[0];
	return BRAND_PALETTE[i % BRAND_PALETTE.length];
}
