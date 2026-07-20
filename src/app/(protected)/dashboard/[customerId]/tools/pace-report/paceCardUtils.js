import { getCobaltChartTokens } from '@/lib/charts/cobaltChartTheme';

export function formatPaceCurrency(val) {
	return val.toLocaleString('da-DK', {
		style: 'currency',
		currency: 'DKK',
		maximumFractionDigits: 0,
	});
}

export function getPaceProgressPercent(actual, budget) {
	if (!budget) return 0;
	return Number(((actual / budget) * 100).toFixed(0));
}

export function getPaceRadialChartOptions(progressPercent) {
	const t = getCobaltChartTokens();

	return {
		chart: { type: 'radialBar', sparkline: { enabled: true } },
		plotOptions: {
			radialBar: {
				startAngle: -100,
				endAngle: 100,
				hollow: { size: '72%' },
				track: { background: t.rule, strokeWidth: '100%' },
				dataLabels: {
					name: { show: false },
					value: {
						offsetY: 12,
						fontSize: '28px',
						fontWeight: 700,
						fontFamily: 'AcidGrotesk, ui-sans-serif, system-ui, sans-serif',
						color: t.ink,
						formatter: (val) => `${val}%`,
					},
				},
			},
		},
		stroke: { lineCap: 'round' },
		fill: { colors: [t.accentLight] },
		labels: ['Progress'],
	};
}
