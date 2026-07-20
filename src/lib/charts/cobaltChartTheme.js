/**
 * Dashboard chart styling (minimal / Apex design).
 * File name retained for imports; reads tokens from `.apex-perf` when available.
 */

function readToken(name, fallback) {
    if (typeof window === "undefined") return fallback;
    const root =
        document.querySelector(".apex-perf") ||
        document.querySelector(".cobalt-perf") ||
        document.documentElement;
    const value = getComputedStyle(root).getPropertyValue(name).trim();
    return value || fallback;
}

export function getCobaltChartTokens() {
    return {
        ink: readToken("--color-ink", "#131313"),
        ink2: readToken("--color-ink-2", "#3a3a3a"),
        muted: readToken("--color-muted", "#6b6b6b"),
        neutral: readToken("--color-muted", "#6b6b6b"),
        accentLight: readToken("--apex-lime", "#c6ed62"),
        rule: readToken("--color-rule", "#e7e5e2"),
        rule2: readToken("--color-rule-2", "#d8d5d0"),
        paper2: readToken("--color-paper-2", "#f4f3f1"),
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
            fontFamily: "AcidGrotesk, ui-sans-serif, system-ui, sans-serif",
            foreColor: t.muted,
            animations: {
                enabled: true,
                easing: "easeinout",
                speed: 450,
            },
        },
        grid: {
            borderColor: t.rule,
            strokeDashArray: 0,
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } },
            padding: { left: 8, right: 16, top: 8, bottom: 0 },
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
                    fontSize: "11px",
                    fontFamily: "AcidGrotesk, ui-sans-serif, system-ui, sans-serif",
                    fontWeight: 500,
                },
            },
        },
        yaxis: {
            labels: {
                style: {
                    colors: t.muted,
                    fontSize: "11px",
                    fontFamily: "AcidGrotesk, ui-sans-serif, system-ui, sans-serif",
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
            hover: { size: 4, sizeOffset: 2 },
        },
        legend: {
            show: true,
            position: "top",
            horizontalAlign: "left",
            offsetY: 0,
            fontSize: "12px",
            fontFamily: "AcidGrotesk, ui-sans-serif, system-ui, sans-serif",
            fontWeight: 500,
            labels: { colors: t.ink2 },
            markers: {
                width: 12,
                height: 3,
                radius: 2,
                offsetX: -3,
                strokeWidth: 0,
            },
            itemMargin: { horizontal: 16, vertical: 6 },
        },
        tooltip: {
            theme: "light",
            style: {
                fontSize: "12px",
                fontFamily: "AcidGrotesk, ui-sans-serif, system-ui, sans-serif",
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

/** Apply minimal palette + current/comparison stroke styling to series. */
export function applyCobaltSeriesStyle(series, options) {
    const t = getCobaltChartTokens();
    const currentColors = [t.ink, t.accentLight, t.ink2, t.neutral];
    const comparisonColors = [t.muted, t.rule2, "#b8b5b0", t.muted];

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
            dashArrays.push(5);
            fillOpacities.push(0.35);
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
