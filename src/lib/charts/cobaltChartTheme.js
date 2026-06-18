/**
 * Cobalt chart styling for performance dashboard graphs.
 * Reads theme tokens from [data-theme="cobalt"] when available.
 */

function readToken(name, fallback) {
    if (typeof window === "undefined") return fallback;
    const root =
        document.querySelector('[data-theme="cobalt"]') ||
        document.querySelector(".cobalt-perf") ||
        document.documentElement;
    const value = getComputedStyle(root).getPropertyValue(name).trim();
    return value || fallback;
}

export function getCobaltChartTokens() {
    return {
        ink: readToken("--color-ink", "#213b34"),
        ink2: readToken("--color-ink-2", "#2d4a42"),
        muted: readToken("--color-muted", "#7a9489"),
        neutral: readToken("--color-neutral", "#5c756a"),
        accentLight: readToken("--color-accent-light", "#3d6b5e"),
        rule: readToken("--color-rule", "#d4ddd9"),
        rule2: readToken("--color-rule-2", "#a8bdb6"),
        paper2: readToken("--color-paper-2", "#eef2f0"),
    };
}

function isComparisonSeries(name) {
    if (!name || name.includes("(Current)")) return false;
    return /\([^)]+\)/.test(name);
}

/** Base Apex options merged into page-specific chart config. */
export function getCobaltChartBaseOptions() {
    const t = getCobaltChartTokens();

    return {
        chart: {
            background: "transparent",
            fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
            foreColor: t.muted,
            animations: {
                enabled: true,
                easing: "easeinout",
                speed: 450,
            },
        },
        grid: {
            borderColor: t.rule,
            strokeDashArray: 3,
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } },
            padding: { left: 4, right: 12, top: 0, bottom: 0 },
        },
        xaxis: {
            axisBorder: { show: true, color: t.rule, height: 1, offsetX: 0, offsetY: 0 },
            axisTicks: { show: false },
            crosshairs: {
                show: true,
                stroke: { color: t.rule2, width: 1, dashArray: 4 },
            },
            labels: {
                style: {
                    colors: t.muted,
                    fontSize: "10px",
                    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                    fontWeight: 500,
                },
            },
        },
        yaxis: {
            labels: {
                style: {
                    colors: t.muted,
                    fontSize: "10px",
                    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                    fontWeight: 500,
                },
            },
        },
        stroke: {
            curve: "smooth",
            lineCap: "round",
        },
        markers: {
            size: 0,
            strokeWidth: 0,
            hover: { size: 5, sizeOffset: 2 },
        },
        legend: {
            show: true,
            position: "top",
            horizontalAlign: "left",
            offsetY: -4,
            fontSize: "10px",
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontWeight: 500,
            labels: { colors: t.ink2 },
            markers: {
                width: 10,
                height: 3,
                radius: 1,
                offsetX: -3,
                strokeWidth: 0,
            },
            itemMargin: { horizontal: 14, vertical: 4 },
        },
        tooltip: {
            theme: "light",
            style: {
                fontSize: "12px",
                fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
            },
            x: { show: true },
        },
        plotOptions: {
            bar: {
                borderRadius: 6,
                columnWidth: "52%",
            },
        },
        dataLabels: { enabled: false },
    };
}

/** Apply Cobalt palette + current/comparison stroke styling to series. */
export function applyCobaltSeriesStyle(series, options) {
    const t = getCobaltChartTokens();
    const currentColors = [t.ink, t.accentLight, t.neutral, t.ink2];
    const comparisonColors = [t.rule2, t.muted, t.rule, t.muted];

    let metricIndex = 0;
    const colors = [];
    const strokeWidths = [];
    const dashArrays = [];
    const fillOpacities = [];

    const styledSeries = series.map((s) => {
        const comparison = isComparisonSeries(s.name);

        if (comparison) {
            const color = comparisonColors[metricIndex % comparisonColors.length];
            colors.push(color);
            strokeWidths.push(1.5);
            dashArrays.push(6);
            fillOpacities.push(0.25);
            return { ...s, color };
        }

        const color = currentColors[metricIndex % currentColors.length];
        metricIndex += 1;
        colors.push(color);
        strokeWidths.push(2.5);
        dashArrays.push(0);
        fillOpacities.push(1);
        return { ...s, color };
    });

    options.colors = colors;
    options.stroke = {
        ...(options.stroke || {}),
        width: strokeWidths.length === 1 ? strokeWidths[0] : strokeWidths,
        dashArray: dashArrays.length === 1 ? dashArrays[0] : dashArrays,
        curve: options.stroke?.curve || "smooth",
        lineCap: "round",
    };
    options.fill = {
        ...(options.fill || {}),
        type: options.fill?.type || "solid",
        opacity: fillOpacities.length === 1 ? fillOpacities[0] : fillOpacities,
    };

    return styledSeries;
}
