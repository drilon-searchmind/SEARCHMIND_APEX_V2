'use client';

import { useMemo } from 'react';
import dayjs from 'dayjs';
import { FiArrowUpRight, FiArrowDownRight, FiTarget, FiTrendingUp, FiClock, FiSettings } from 'react-icons/fi';
import GraphCard from '@/components/dashboard/GraphCard';
import { COMMERCE_CHART_CHROME, METRIC_CHART_PALETTE } from '@/components/dashboard/chartColors';
import { hexWithAlpha } from '@/lib/charts/chartSeriesColors';

const ACTUAL_COLOR = METRIC_CHART_PALETTE[0];
const TARGET_COLOR = '#859085';

const fmtInt = (v) => Math.round(Number(v) || 0).toLocaleString('da-DK');
const fmtKr = (v) => `${fmtInt(v)} kr.`;
const fmtRatio = (v) =>
	Number.isFinite(v) ? v.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
const fmtPct = (v, dp = 1) =>
	Number.isFinite(v) ? `${(v * 100).toLocaleString('da-DK', { maximumFractionDigits: dp })}%` : '-';
const compact = (v) => {
	const n = Number(v) || 0;
	const abs = Math.abs(n);
	if (abs >= 1e6) return `${(n / 1e6).toLocaleString('da-DK', { maximumFractionDigits: 1 })}m`;
	if (abs >= 1e3) return `${Math.round(n / 1e3).toLocaleString('da-DK')}k`;
	return Math.round(n).toLocaleString('da-DK');
};

/** Status tag per DESIGN.md · Tags. Spend is judged against budget, outcomes against target. */
function statusFor(pace, kind) {
	if (!Number.isFinite(pace)) return null;
	if (kind === 'spend') {
		if (Math.abs(pace - 1) <= 0.05) return { tone: 'ok', label: 'On budget' };
		return { tone: 'warn', label: pace > 1 ? 'Overspending' : 'Underspending' };
	}
	if (pace >= 1) return { tone: 'ok', label: 'Ahead' };
	if (pace >= 0.95) return { tone: 'warn', label: 'Slightly behind' };
	return { tone: 'bad', label: 'Behind' };
}

function Delta({ ratio, goodUp = true }) {
	if (!Number.isFinite(ratio)) return null;
	const pct = (ratio - 1) * 100;
	const good = goodUp ? pct >= 0 : pct <= 0;
	return (
		<span className={`apex-ov-delta ${good ? 'is-up' : 'is-down'}`}>
			{pct < 0 ? <FiArrowDownRight aria-hidden /> : <FiArrowUpRight aria-hidden />}
			{`${pct > 0 ? '+' : ''}${pct.toLocaleString('da-DK', { maximumFractionDigits: 1 })}%`}
		</span>
	);
}

function SetTargets({ onOpenSettings, children }) {
	return (
		<button type="button" className="apex-pace-cta" onClick={onOpenSettings}>
			<FiSettings aria-hidden />
			{children}
		</button>
	);
}

/** Bar with a 2px marker at the share of the month elapsed (DESIGN.md · Pacing bars). */
function PacingBar({ label, actual, target, frac, projected, color }) {
	const used = target > 0 ? actual / target : NaN;
	return (
		<div className="apex-pace-bar">
			<div className="apex-pace-bar__top">
				<b>{label}</b>
				<span>
					{compact(actual)} of {compact(target)}
				</span>
			</div>
			<div className="apex-ov-bar">
				<i style={{ width: `${Math.min(100, Math.max(0, (used || 0) * 100))}%`, background: color }} />
				<span className="apex-pace-bar__marker" style={{ left: `${Math.min(100, frac * 100)}%` }} />
			</div>
			<div className="apex-pace-bar__mini">
				<span>
					Used <b>{fmtPct(used)}</b>
				</span>
				<span>
					Projected <b>{compact(projected)}</b>
				</span>
			</div>
		</div>
	);
}

/** One-sentence lede for the heading. */
export function paceLede({ paceMeta, conversionPaceAnalysis, revenueLabel }) {
	if (!paceMeta || !conversionPaceAnalysis) return null;
	const dim = paceMeta.daysInMonths;
	const el = Math.max(1, paceMeta.daysPassed);
	const month = dayjs(paceMeta.monthsEnd).format('MMMM YYYY');
	const projected = (conversionPaceAnalysis.valueUntilLastDay / el) * dim;
	const label = revenueLabel || 'Revenue';
	// fmtKr already ends in "kr." so the sentence needs no extra full stop after it
	return paceMeta.hasRevenueTarget
		? `${month}, day ${el} of ${dim}. ${label} is projecting ${fmtKr(projected)} against a target of ${fmtKr(conversionPaceAnalysis.budget)}`
		: `${month}, day ${el} of ${dim}. At the current pace, ${label} lands at ${fmtKr(projected)} No revenue target is set yet.`;
}

export default function PaceOverview({
	paceMeta,
	paceAnalysis,
	conversionPaceAnalysis,
	conversionValueData,
	revenueLabel = 'Revenue',
	onOpenSettings,
}) {
	const m = useMemo(() => {
		if (!paceMeta || !paceAnalysis || !conversionPaceAnalysis) return null;
		const dim = paceMeta.daysInMonths;
		const el = Math.max(1, Math.min(dim, paceMeta.daysPassed));
		const frac = el / dim;
		const revActual = conversionPaceAnalysis.valueUntilLastDay;
		const revTarget = paceMeta.hasRevenueTarget ? conversionPaceAnalysis.budget : null;
		const spendActual = paceAnalysis.actualSpendToDate;
		const budget = paceMeta.hasBudget ? paceAnalysis.budget : null;
		const project = (v) => (v / el) * dim;
		const roasActual = spendActual > 0 ? revActual / spendActual : NaN;
		const roasTarget = revTarget && budget ? revTarget / budget : NaN;
		return {
			dim,
			el,
			frac,
			revActual,
			revTarget,
			revPace: revTarget ? conversionPaceAnalysis.pace : NaN,
			revProjected: project(revActual),
			neededPerDay: revTarget && dim > el ? (revTarget - revActual) / (dim - el) : NaN,
			perDaySoFar: revActual / el,
			spendActual,
			budget,
			spendPace: budget ? paceAnalysis.pace : NaN,
			spendProjected: project(spendActual),
			roasActual,
			roasTarget,
		};
	}, [paceMeta, paceAnalysis, conversionPaceAnalysis]);

	const chart = useMemo(() => {
		if (!m || !paceMeta) return null;
		const start = dayjs(paceMeta.monthsStart);
		const days = Array.from({ length: m.dim }, (_, i) => start.add(i, 'day').format('YYYY-MM-DD'));
		const actualByDay = new Map((conversionValueData || []).map((d) => [String(d.period).slice(0, 10), Number(d.revenue) || 0]));
		const lastActualIdx = Math.min(m.el, m.dim) - 1;
		const actual = days.map((d, i) => (i <= lastActualIdx && actualByDay.has(d) ? Math.round(actualByDay.get(d)) : null));
		const lastActual = actual[lastActualIdx] ?? m.revActual;
		const perDay = lastActual / (lastActualIdx + 1);
		const projection = days.map((_, i) => (i < lastActualIdx ? null : Math.round(lastActual + perDay * (i - lastActualIdx))));
		const series = [{ name: 'Actual', type: 'area', data: actual }];
		const colors = [ACTUAL_COLOR];
		const dash = [0];
		const widths = [2.6];
		const fills = [0.1];
		if (m.revTarget) {
			series.push({ name: 'Target', type: 'line', data: days.map((_, i) => Math.round((m.revTarget * (i + 1)) / m.dim)) });
			colors.push(TARGET_COLOR);
			dash.push(4);
			widths.push(1.6);
			fills.push(1);
		}
		series.push({ name: 'Projection', type: 'line', data: projection });
		colors.push(hexWithAlpha(ACTUAL_COLOR, 0.7));
		dash.push(3);
		widths.push(2);
		fills.push(1);

		const options = {
			chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: COMMERCE_CHART_CHROME.fontFamily },
			colors,
			stroke: { width: widths, curve: 'straight', dashArray: dash },
			fill: { type: 'solid', opacity: fills },
			markers: { size: 0, hover: { size: 5 }, colors: colors.map(() => '#ffffff'), strokeColors: colors, strokeWidth: 2 },
			xaxis: {
				categories: days,
				tickAmount: 8,
				labels: {
					rotate: 0,
					hideOverlappingLabels: true,
					style: { colors: COMMERCE_CHART_CHROME.axisLabel },
					formatter: (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? dayjs(v).format('D MMM') : v),
				},
				axisTicks: { show: false },
				axisBorder: { show: true, color: COMMERCE_CHART_CHROME.grid },
				tooltip: { enabled: false },
			},
			yaxis: { min: 0, tickAmount: 4, forceNiceScale: true, labels: { formatter: compact } },
			grid: { borderColor: COMMERCE_CHART_CHROME.grid, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
			legend: { show: true, position: 'top', horizontalAlign: 'left' },
			dataLabels: { enabled: false },
			tooltip: {
				theme: 'dark',
				shared: true,
				intersect: false,
				x: { formatter: (v, { dataPointIndex } = {}) => (days[dataPointIndex] ? dayjs(days[dataPointIndex]).format('ddd, D MMM') : v) },
				y: { formatter: (v) => (v == null ? '-' : fmtKr(v)) },
			},
		};
		return { series, options };
	}, [m, paceMeta, conversionValueData]);

	if (!m) return null;

	const channels = paceMeta.channelSpend || [];
	const channelTotal = channels.reduce((s, c) => s + c.spend, 0);

	const rows = [
		{ name: revenueLabel, target: m.revTarget, actual: m.revActual, kind: 'outcome', fmt: fmtKr },
		{ name: 'Ad spend', target: m.budget, actual: m.spendActual, kind: 'spend', fmt: fmtKr },
	];

	return (
		<>
			<div className="apex-ov-grid apex-ov-grid--hero apex-pace-row">
				<div className="apex-ov-card apex-ov-kpi is-hero apex-pace-kpi">
					<div className="apex-ov-kpi__label">
						<span>Revenue pace</span>
					</div>
					{m.revTarget ? (
						<>
							<div className="apex-ov-kpi__value">
								{(m.revPace * 100).toLocaleString('da-DK', { maximumFractionDigits: 1 })}
								<small>%</small>
							</div>
							<div className="apex-ov-kpi__row">
								<Delta ratio={m.revPace} />
								<span className="apex-ov-vs">vs month-to-date target</span>
							</div>
						</>
					) : (
						<>
							<div className="apex-ov-kpi__value">-</div>
							<SetTargets onOpenSettings={onOpenSettings}>Set a revenue target</SetTargets>
						</>
					)}
				</div>

				<div className="apex-ov-card apex-ov-kpi apex-pace-kpi">
					<div className="apex-ov-kpi__label">
						<span className="apex-ov-ic"><FiTarget aria-hidden /></span>
						<span>Projected month</span>
					</div>
					<div className="apex-ov-kpi__value">
						{fmtInt(m.revProjected)}
						<small>kr.</small>
					</div>
					<div className="apex-ov-kpi__row">
						{m.revTarget ? <Delta ratio={m.revProjected / m.revTarget} /> : null}
						<span className="apex-ov-vs">{m.revTarget ? 'vs monthly target' : 'At the current daily pace'}</span>
					</div>
				</div>

				<div className="apex-ov-card apex-ov-kpi apex-pace-kpi">
					<div className="apex-ov-kpi__label">
						<span className="apex-ov-ic"><FiTrendingUp aria-hidden /></span>
						<span>{m.revTarget ? 'Needed per day' : 'Average per day'}</span>
					</div>
					<div className="apex-ov-kpi__value">
						{fmtInt(m.revTarget && Number.isFinite(m.neededPerDay) ? Math.max(0, m.neededPerDay) : m.perDaySoFar)}
						<small>kr.</small>
					</div>
					<div className="apex-ov-kpi__row">
						<span className="apex-ov-vs">
							{m.revTarget
								? m.neededPerDay <= 0
									? 'Target already reached'
									: `So far ${fmtKr(m.perDaySoFar)} per day`
								: 'Month to date'}
						</span>
					</div>
				</div>

				<div className="apex-ov-card apex-ov-kpi apex-pace-kpi">
					<div className="apex-ov-kpi__label">
						<span className="apex-ov-ic"><FiClock aria-hidden /></span>
						<span>Month elapsed</span>
					</div>
					<div className="apex-ov-kpi__value">
						{(m.frac * 100).toLocaleString('da-DK', { maximumFractionDigits: 0 })}
						<small>%</small>
					</div>
					<div className="apex-ov-kpi__row">
						<span className="apex-ov-vs">
							{m.el} of {m.dim} days
						</span>
					</div>
				</div>
			</div>

			<div className="apex-ov-grid apex-pace-split apex-pace-row">
				<GraphCard
					variant="cobalt"
					hideChartToggle
					title={`Cumulative ${revenueLabel}`}
					chartType="line"
					height={280}
					chartOptions={chart.options}
					chartSeries={chart.series}
				/>

				<section className="apex-ov-card apex-pace-budget">
					<div className="apex-ov-card__head">
						<h3>Budget pacing</h3>
						<span className="apex-ov-sub">Line marks time elapsed</span>
					</div>
					<div className="apex-pace-bars">
						{m.budget ? (
							<PacingBar
								label="Ad spend"
								actual={m.spendActual}
								target={m.budget}
								frac={m.frac}
								projected={m.spendProjected}
								color={ACTUAL_COLOR}
							/>
						) : (
							<div className="apex-pace-missing">
								<span>No marketing budget set for this month.</span>
								<SetTargets onOpenSettings={onOpenSettings}>Set budget</SetTargets>
							</div>
						)}
						{m.revTarget ? (
							<PacingBar
								label={revenueLabel}
								actual={m.revActual}
								target={m.revTarget}
								frac={m.frac}
								projected={m.revProjected}
								color="#EA580C"
							/>
						) : null}
					</div>
					{channels.length > 0 ? (
						<div className="apex-pace-channels">
							<div className="apex-pace-channels__head">Spend by channel, month to date</div>
							{channels.map((c) => (
								<div key={c.id} className="apex-pace-channel">
									<span>{c.label}</span>
									<span className="apex-pace-channel__amt">{fmtKr(c.spend)}</span>
									<span className="apex-pace-channel__pc">{fmtPct(channelTotal > 0 ? c.spend / channelTotal : 0, 0)}</span>
								</div>
							))}
						</div>
					) : null}
				</section>
			</div>

			<section className="apex-ov-card apex-pace-row">
				<div className="apex-ov-card__head">
					<h3>Targets and pace</h3>
					<span className="apex-ov-sub">Expected to date assumes an even daily split of the monthly target</span>
				</div>
				<div className="apex-mk-tbl-wrap">
					<table className="apex-mk-tbl">
						<thead>
							<tr>
								<th>Metric</th>
								<th>Monthly target</th>
								<th>Month to date</th>
								<th>Expected to date</th>
								<th>Pace</th>
								<th>Projected</th>
								<th>Vs target</th>
								<th>Status</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((r) => {
								const expected = r.target ? r.target * m.frac : NaN;
								const pace = r.target ? r.actual / expected : NaN;
								const projected = (r.actual / m.el) * m.dim;
								const diff = r.target ? projected - r.target : NaN;
								const st = statusFor(pace, r.kind);
								const diffBad = r.kind === 'spend' ? false : diff < 0;
								return (
									<tr key={r.name}>
										<td>{r.name}</td>
										<td>{r.target ? r.fmt(r.target) : <span className="apex-mk-muted">Not set</span>}</td>
										<td>{r.fmt(r.actual)}</td>
										<td>{r.target ? r.fmt(expected) : '-'}</td>
										<td>{fmtPct(pace)}</td>
										<td>{r.fmt(projected)}</td>
										<td className={diffBad ? 'is-neg' : undefined}>
											{Number.isFinite(diff) ? `${diff >= 0 ? '+' : '-'}${r.fmt(Math.abs(diff))}` : '-'}
										</td>
										<td>{st ? <span className={`apex-mk-tag is-${st.tone}`}>{st.label}</span> : <span className="apex-mk-muted">-</span>}</td>
									</tr>
								);
							})}
							<tr>
								<td>ROAS</td>
								<td>{Number.isFinite(m.roasTarget) ? fmtRatio(m.roasTarget) : <span className="apex-mk-muted">Not set</span>}</td>
								<td>{fmtRatio(m.roasActual)}</td>
								<td>{Number.isFinite(m.roasTarget) ? fmtRatio(m.roasTarget) : '-'}</td>
								<td>{Number.isFinite(m.roasTarget) ? fmtPct(m.roasActual / m.roasTarget) : '-'}</td>
								<td>{fmtRatio(m.roasActual)}</td>
								<td className={m.roasActual < m.roasTarget ? 'is-neg' : undefined}>
									{Number.isFinite(m.roasTarget) ? `${m.roasActual >= m.roasTarget ? '+' : '-'}${fmtRatio(Math.abs(m.roasActual - m.roasTarget))}` : '-'}
								</td>
								<td>
									{(() => {
										const st = statusFor(m.roasActual / m.roasTarget, 'outcome');
										return st ? <span className={`apex-mk-tag is-${st.tone}`}>{st.label}</span> : <span className="apex-mk-muted">-</span>;
									})()}
								</td>
							</tr>
						</tbody>
					</table>
				</div>
				<p className="apex-mk-note">
					Targets come from the property objectives. Target ROAS is the revenue target divided by the marketing budget.{' '}
					<button type="button" className="apex-pace-link" onClick={onOpenSettings}>
						Edit objectives
					</button>
				</p>
			</section>
		</>
	);
}
