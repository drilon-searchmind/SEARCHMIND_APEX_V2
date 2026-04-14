/** Select value for Keyword Planner “all geos” (no geoTargetConstants). */
export const WORLDWIDE_COUNTRY_VALUE = "__WORLDWIDE__";

export function isWorldwideGeoValue(value) {
    const s = String(value ?? "").trim();
    return s === WORLDWIDE_COUNTRY_VALUE || s.toLowerCase() === "worldwide";
}

/**
 * ISO 3166-1 alpha-2 countries for searchable select (labels via Intl).
 * @returns {{ value: string, label: string }[]}
 */
export function getCountrySelectOptions() {
    try {
        const dn = new Intl.DisplayNames(["en"], { type: "region" });
        const opts = [{ value: WORLDWIDE_COUNTRY_VALUE, label: "Worldwide" }];
        for (let i = 65; i <= 90; i++) {
            for (let j = 65; j <= 90; j++) {
                const code = String.fromCharCode(i) + String.fromCharCode(j);
                const name = dn.of(code);
                if (name && name !== code && name.length > 2) {
                    opts.push({ value: code, label: name });
                }
            }
        }
        opts.sort((a, b) => {
            if (a.value === WORLDWIDE_COUNTRY_VALUE) return -1;
            if (b.value === WORLDWIDE_COUNTRY_VALUE) return 1;
            return a.label.localeCompare(b.label);
        });
        return opts;
    } catch {
        return [
            { value: WORLDWIDE_COUNTRY_VALUE, label: "Worldwide" },
            { value: "DK", label: "Denmark" },
        ];
    }
}

/**
 * Match saved geo string (ISO code or English country name) to an option.
 */
export function matchCountryOption(geoLabel, options) {
    const g = String(geoLabel ?? "").trim();
    if (!g) return options.find((o) => o.value === "DK") ?? options[0];
    if (isWorldwideGeoValue(g)) {
        return options.find((o) => o.value === WORLDWIDE_COUNTRY_VALUE) ?? null;
    }
    const lower = g.toLowerCase();
    return (
        options.find((o) => o.value === g) ||
        options.find((o) => o.label === g) ||
        options.find((o) => o.label.toLowerCase() === lower) ||
        options.find((o) => o.value.toLowerCase() === lower) ||
        null
    );
}
