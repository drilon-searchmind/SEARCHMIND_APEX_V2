/**
 * ISO 3166-1 alpha-2 countries for searchable select (labels via Intl).
 * @returns {{ value: string, label: string }[]}
 */
export function getCountrySelectOptions() {
    try {
        const dn = new Intl.DisplayNames(["en"], { type: "region" });
        const opts = [];
        for (let i = 65; i <= 90; i++) {
            for (let j = 65; j <= 90; j++) {
                const code = String.fromCharCode(i) + String.fromCharCode(j);
                const name = dn.of(code);
                if (name && name !== code && name.length > 2) {
                    opts.push({ value: code, label: name });
                }
            }
        }
        opts.sort((a, b) => a.label.localeCompare(b.label));
        return opts;
    } catch {
        return [{ value: "DK", label: "Denmark" }];
    }
}

/**
 * Match saved geo string (ISO code or English country name) to an option.
 */
export function matchCountryOption(geoLabel, options) {
    const g = String(geoLabel ?? "").trim();
    if (!g) return options.find((o) => o.value === "DK") ?? options[0];
    const lower = g.toLowerCase();
    return (
        options.find((o) => o.value === g) ||
        options.find((o) => o.label === g) ||
        options.find((o) => o.label.toLowerCase() === lower) ||
        options.find((o) => o.value.toLowerCase() === lower) ||
        null
    );
}
