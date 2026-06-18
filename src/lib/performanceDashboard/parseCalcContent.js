/** Parse popOverContent strings into structured calc display parts. */

export function parseCalcContent(popOverContent) {
    if (!popOverContent) {
        return { calcLines: [], formulaLines: [], noteLines: [] };
    }

    const lines = popOverContent
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

    const calcLines = lines.filter((l) => /^=/.test(l) && /\d/.test(l));
    const formulaLines = lines.filter((l) => !/^=/.test(l) && !/^Note:/i.test(l));
    const noteLines = lines.filter((l) => /^Note:/i.test(l));

    return { calcLines, formulaLines, noteLines };
}

export function parseCalcValueLabels(calcValueLabels) {
    if (!calcValueLabels) return [];

    return calcValueLabels
        .split("\n")
        .filter(Boolean)
        .map((line) => {
            const colonIdx = line.indexOf(":");
            if (colonIdx < 0) return { key: line, value: "" };
            return {
                key: line.slice(0, colonIdx).trim(),
                value: line.slice(colonIdx + 1).trim(),
            };
        });
}

export function toMetricSlug(key, label) {
    if (key) return String(key).replace(/_/g, "-");
    return (label || "metric")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

export function toJsonFieldKey(label) {
    return label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
}
