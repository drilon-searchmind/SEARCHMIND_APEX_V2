import { getCobaltChartTokens } from '@/lib/charts/cobaltChartTheme';

export const fmt = (val) =>
    val.toLocaleString("da-DK", {
        style: "currency",
        currency: "DKK",
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
    });

export const displayVal = (val, zeroAsDash = true) =>
    zeroAsDash && (val === 0 || val === undefined) ? "-" : fmt(val);

export const percentChange = (prev, curr) =>
    prev !== 0 && prev !== undefined && prev !== null ? ((curr - prev) / prev) * 100 : null;

export function getPnlRadialChartOptions(progressPercent, fillColor) {
    const t = getCobaltChartTokens();
    const fill = fillColor || t.accentLight;

    return {
        chart: { type: 'radialBar', sparkline: { enabled: true } },
        plotOptions: {
            radialBar: {
                startAngle: -100,
                endAngle: 100,
                hollow: { size: '68%' },
                track: { background: t.rule, strokeWidth: '100%' },
                dataLabels: {
                    name: { show: false },
                    value: {
                        offsetY: 10,
                        fontSize: '24px',
                        fontWeight: 700,
                        fontFamily: 'AcidGrotesk, ui-sans-serif, system-ui, sans-serif',
                        color: progressPercent < 0 ? 'var(--color-error, #b91c1c)' : t.ink,
                        formatter: (val) => `${val}%`,
                    },
                },
            },
        },
        stroke: { lineCap: 'round' },
        fill: { colors: [fill] },
        labels: ['Margin'],
    };
}
