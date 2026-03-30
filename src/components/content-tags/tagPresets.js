/** Preset hex colors for new tags (admin) */
export const TAG_COLOR_PRESETS = [
    "#0f766e",
    "#0369a1",
    "#7c3aed",
    "#b45309",
    "#be123c",
    "#15803d",
    "#4338ca",
    "#64748b",
    "#db2777",
    "#ca8a04",
    "#059669",
    "#2563eb",
];

export function inlineTagStyle(hex) {
    const c = hex && /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/.test(hex) ? hex : "#64748b";
    return {
        backgroundColor: `${c}22`,
        color: c,
        border: `1px solid ${c}55`,
    };
}
