'use client';

import { useMemo } from 'react';
import dayjs from 'dayjs';
import {
	FiArrowUpRight,
	FiArrowDownRight,
	FiEye,
	FiShoppingBag,
	FiCreditCard,
	FiTarget,
} from 'react-icons/fi';
import GraphCard from '@/components/dashboard/GraphCard';
import { COMMERCE_CHART_CHROME, METRIC_CHART_PALETTE } from '@/components/dashboard/chartColors';
import { hexWithAlpha } from '@/lib/charts/chartSeriesColors';

/**
 * Ad spend channels in stack order. Distinct, non-brand hues so channels are easy to tell
 * apart (same family as METRIC_CHART_PALETTE, DESIGN.md · Chart palette).
 */
const SPEND_CHANNELS = [
	{ key: 'psCost', label: 'Meta', color: '#2563EB' },
	{ key: 'ppcCost', label: 'Google', color: '#EA580C' },
	{ key: 'pinterestCost', label: 'Pinterest', color: '#DB2777' },
	{ key: 'snapchatCost', label: 'Snapchat', color: '#CA8A04' },
	{ key: 'bingCost', label: 'Microsoft (Bing)', color: '#0891B2' },
	{ key: 'redditCost', label: 'Reddit', color: '#7C3AED' },
];

const REVENUE_COLOR = METRIC_CHART_PALETTE[0];

const ymd = (d) => String(d).slice(0, 10);
const fmtInt = (v) => Math.round(Number(v) || 0).toLocaleString('da-DK');
const fmtRatio = (v) =>
	v != null && Number.isFinite(Number(v))
		? Number(v).toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
		: '-';
const shortDate = (d) => dayjs(d).format('D MMM');
const longDate = (d) => dayjs(d).format('ddd, D MMM');

/** Compact axis labels (150k, 1,5m) per DESIGN.md · Charts. */
function compact(v) {
	if (typeof v !== 'number' || Number.isNaN(v)) return v;
	const abs = Math.abs(v);
	if (abs >= 1e6) return `${(v / 1e6).toLocaleString('da-DK', { maximumFractionDigits: 1 })}m`;
	if (abs >= 1e3) return `${Math.round(v / 1e3).toLocaleString('da-DK')}k`;
	return v.toLocaleString('da-DK', { maximumFractionDigits: 0 });
}

function spendOf(row) {
	if (!row) return 0;
	return row.totalMarketingSpend ?? SPEND_CHANNELS.reduce((s, c) => s + (Number(row[c.key]) || 0), 0);
}

/** Change chip; colour follows good or bad (spend and CPA going up is red). */
function Delta({ cur, prev, goodUp = true }) {
	if (cur == null || prev == null || !Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0) return null;
	const pct = (cur / prev - 1) * 100;
	const good = goodUp ? pct >= 0 : pct <= 0;
	const tone = Math.abs(pct) < 0.05 ? 'is-flat' : good ? 'is-up' : 'is-down';
	const text = `${pct > 0 ? '+' : ''}${pct.toLocaleString('da-DK', { maximumFractionDigits: 1 })}%`;
	return (
		<span className={`apex-ov-delta ${tone}`}>
			{pct < 0 ? <FiArrowDownRight aria-hidden /> : <FiArrowUpRight aria-hidden />}
			{text}
		</span>
	);
}

function Kpi({ label, value, unit, cur, prev, goodUp, vs, icon: Icon, cost = false, hero = false }) {
	return (
		<div className={`apex-ov-card apex-ov-kpi apex-daily-kpi${hero ? ' is-hero' : ''}`}>
			<div className="apex-ov-kpi__label">
				{hero ? null : (
					<span className={`apex-ov-ic${cost ? ' is-cost' : ''}`}>
						<Icon aria-hidden />
					</span>
				)}
				<span>{label}</span>
				{hero ? <FiEye className="apex-ov-kpi__eye" aria-hidden /> : null}
			</div>
			<div className="apex-ov-kpi__value">
				{value}
				{unit ? <small>{unit}</small> : null}
			</div>
			<div className="apex-ov-kpi__row">
				<Delta cur={cur} prev={prev} goodUp={goodUp} />
				{vs ? <span className="apex-ov-vs">{vs}</span> : null}
			</div>
		</div>
	);
}

/** One-sentence lede for the page heading. */
export function dailyLede(rows, revenueLabel = 'Net Revenue') {
	const last = rows?.[rows.length - 1];
	if (!last) return null;
	const isYesterday = ymd(last.date) === dayjs().subtract(1, 'day').format('YYYY-MM-DD');
	const when = isYesterday ? `Yesterday (${longDate(last.date)})` : longDate(last.date);
	return `${when} brought in ${fmtInt(last.netRevenue)} kr. of ${revenueLabel.toLowerCase()} on ${fmtInt(spendOf(last))} kr. of ad spend.`;
}

export default function DailySummary({ rows, rowsWeekAgo, metricColumns, revenueLabel = 'Net Revenue' }) {
	const weekAgoByDate = useMemo(
		() => new Map((rowsWeekAgo || []).map((r) => [ymd(r.date), r])),
		[rowsWeekAgo]
	);

	const channels = useMemo(() => {
		const allowed = new Set((metricColumns || []).map((c) => c.key));
		return SPEND_CHANNELS.filter(
			(c) => allowed.has(c.key) && (rows || []).some((r) => (Number(r[c.key]) || 0) > 0)
		);
	}, [metricColumns, rows]);

	const charts = useMemo(() => {
		const list = rows || [];
		const categories = list.map((r) => ymd(r.date));
		const xaxis = {
			categories,
			tickAmount: Math.min(categories.length, 8),
			labels: {
				rotate: 0,
				hideOverlappingLabels: true,
				style: { colors: COMMERCE_CHART_CHROME.axisLabel },
				formatter: (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? shortDate(v) : v),
			},
			axisTicks: { show: false },
			axisBorder: { show: true, color: COMMERCE_CHART_CHROME.grid },
			tooltip: { enabled: false },
		};
		const base = {
			chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: COMMERCE_CHART_CHROME.fontFamily },
			xaxis,
			yaxis: { tickAmount: 4, forceNiceScale: true, min: 0, labels: { formatter: compact } },
			grid: { borderColor: COMMERCE_CHART_CHROME.grid, strokeDashArray: 0, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
			dataLabels: { enabled: false },
			legend: { show: true, position: 'top', horizontalAlign: 'left' },
			tooltip: {
				theme: 'dark',
				shared: true,
				intersect: false,
				x: { formatter: (v, { dataPointIndex } = {}) => (categories[dataPointIndex] ? longDate(categories[dataPointIndex]) : v) },
				y: { formatter: (v) => (v == null ? '-' : `${fmtInt(v)} kr.`) },
			},
		};

		const spendColors = channels.map((c) => c.color);
		const spend = {
			series: channels.map((c) => ({ name: c.label, data: list.map((r) => Math.round(Number(r[c.key]) || 0)) })),
			options: {
				...base,
				chart: { ...base.chart, stacked: true },
				colors: spendColors,
				plotOptions: {
					bar: {
						columnWidth: '62%',
						borderRadius: 2,
						borderRadiusApplication: 'end',
						borderRadiusWhenStacked: 'last',
					},
				},
				states: { hover: { filter: { type: 'none' } } },
				stroke: { width: 0 },
				fill: { opacity: 1 },
			},
		};

		const weekAgo = list.map((r) => {
			const wa = weekAgoByDate.get(dayjs(ymd(r.date)).subtract(7, 'day').format('YYYY-MM-DD'));
			return wa ? Math.round(Number(wa.netRevenue) || 0) : null;
		});
		const revenueColors = [REVENUE_COLOR, hexWithAlpha(REVENUE_COLOR, 0.55)];
		const revenue = {
			series: [
				{ name: revenueLabel, type: 'area', data: list.map((r) => Math.round(Number(r.netRevenue) || 0)) },
				{ name: 'Same day last week', type: 'line', data: weekAgo },
			],
			options: {
				...base,
				colors: revenueColors,
				stroke: { width: [2.2, 1.6], curve: 'smooth', dashArray: [0, 4] },
				fill: { type: 'solid', opacity: [0.1, 1] },
				markers: { size: 0, hover: { size: 5 }, colors: ['#ffffff', '#ffffff'], strokeColors: revenueColors, strokeWidth: 2 },
			},
		};

		return { spend, revenue };
	}, [rows, channels, weekAgoByDate, revenueLabel]);

	const last = rows?.[rows.length - 1];
	if (!last) return null;

	const lastYmd = ymd(last.date);
	const prevYmd = dayjs(lastYmd).subtract(7, 'day').format('YYYY-MM-DD');
	const prev = weekAgoByDate.get(prevYmd) || null;
	const isYesterday = lastYmd === dayjs().subtract(1, 'day').format('YYYY-MM-DD');
	const vs = prev ? `vs ${longDate(prevYmd)}` : null;

	const spendNow = spendOf(last);
	const spendPrev = prev ? spendOf(prev) : null;
	const cpaNow = last.orders > 0 ? spendNow / last.orders : null;
	const cpaPrev = prev && prev.orders > 0 ? spendPrev / prev.orders : null;

	return (
		<>
			<div className="apex-ov-grid apex-ov-grid--hero apex-daily-hero">
				<Kpi
					hero
					label={isYesterday ? `${revenueLabel} yesterday` : `${revenueLabel}, ${longDate(lastYmd)}`}
					value={fmtInt(last.netRevenue)}
					unit="kr."
					cur={last.netRevenue}
					prev={prev?.netRevenue}
					goodUp
					vs={vs}
				/>
				<Kpi label="Orders" icon={FiShoppingBag} value={fmtInt(last.orders)} cur={last.orders} prev={prev?.orders} goodUp vs={vs} />
				<Kpi label="Ad spend" icon={FiCreditCard} cost value={fmtInt(spendNow)} unit="kr." cur={spendNow} prev={spendPrev} goodUp={false} vs={vs} />
				<Kpi
					label="CPA"
					icon={FiTarget}
					value={cpaNow != null ? fmtInt(cpaNow) : '-'}
					unit={cpaNow != null ? 'kr.' : null}
					cur={cpaNow}
					prev={cpaPrev}
					goodUp={false}
					vs={`ROAS ${fmtRatio(last.roas)}`}
				/>
			</div>

			<div className="apex-ov-grid apex-ov-grid--2 apex-daily-charts">
				{channels.length > 0 ? (
					<GraphCard
						variant="cobalt"
						hideChartToggle
						title="Daily ad spend"
						chartType="bar"
						height={260}
						chartOptions={charts.spend.options}
						chartSeries={charts.spend.series}
					/>
				) : (
					<div className="apex-ov-card apex-daily-empty">No ad spend in the selected range.</div>
				)}
				<GraphCard
					variant="cobalt"
					hideChartToggle
					title={`Daily ${revenueLabel.toLowerCase()}`}
					chartType="line"
					height={260}
					chartOptions={charts.revenue.options}
					chartSeries={charts.revenue.series}
				/>
			</div>
		</>
	);
}
