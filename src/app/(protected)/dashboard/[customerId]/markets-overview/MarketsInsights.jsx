'use client';

import { useMemo, useState } from 'react';
import { FiArrowUpRight, FiArrowDownRight, FiEye, FiCheckCircle, FiBarChart2, FiAlertTriangle } from 'react-icons/fi';

const fmtInt = (v) => Math.round(Number(v) || 0).toLocaleString('da-DK');
const fmtRatio = (v) =>
	v != null && Number.isFinite(Number(v))
		? Number(v).toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
		: '-';
const fmtPct = (v, dp = 1) =>
	v != null && Number.isFinite(Number(v))
		? `${(Number(v) * 100).toLocaleString('da-DK', { maximumFractionDigits: dp })}%`
		: '-';
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Health per market from POAS (break-even 1,0) and net profit.
 * @returns {{ tone: 'ok'|'warn'|'bad', label: string }}
 */
export function marketStatus(row) {
	const poas = Number(row?.poas);
	if (num(row?.netProfit) < 0) return { tone: 'bad', label: 'Loss-making' };
	if (Number.isFinite(poas) && poas < 1) return { tone: 'bad', label: 'Below break-even' };
	if (Number.isFinite(poas) && poas < 1.5) return { tone: 'warn', label: 'Watch' };
	return { tone: 'ok', label: 'Profitable' };
}

/** Revenue share vs spend share: >1 means the market returns more than its slice of the budget. */
function efficiencyTag(index) {
	if (!Number.isFinite(index)) return null;
	if (index >= 1.1) return { tone: 'ok', label: 'Over-delivering' };
	if (index >= 0.9) return { tone: 'neutral', label: 'In line' };
	return { tone: 'bad', label: 'Under-delivering' };
}

function Growth({ cur, prev, goodUp = true, className = '' }) {
	if (prev == null || !Number.isFinite(Number(prev)) || Number(prev) === 0) return null;
	const pct = (num(cur) / Number(prev) - 1) * 100;
	const good = goodUp ? pct >= 0 : pct <= 0;
	return (
		<span className={`apex-ov-delta ${good ? 'is-up' : 'is-down'} ${className}`}>
			{pct < 0 ? <FiArrowDownRight aria-hidden /> : <FiArrowUpRight aria-hidden />}
			{`${pct > 0 ? '+' : ''}${pct.toLocaleString('da-DK', { maximumFractionDigits: 1 })}%`}
		</span>
	);
}

/** Donut (DESIGN.md · Charts): 36px ring, 3px gaps, centre label follows hover. */
function Donut({ items, total, active, onHover }) {
	const R = 80;
	const C = 2 * Math.PI * R;
	const gap = items.length > 1 ? 3 : 0;
	const lens = items.map((it) => (total > 0 ? (it.value / total) * C : 0));
	const offsets = lens.map((_, i) => lens.slice(0, i).reduce((s, l) => s + l, 0));
	const focus = items.find((it) => it.id === active) || items[0];
	return (
		<div className="apex-mk-donut">
			<svg viewBox="0 0 220 220" role="img" aria-label="Net revenue by market">
				<g transform="rotate(-90 110 110)">
					{items.map((it, i) => (
						<circle
							key={it.id}
							cx="110"
							cy="110"
							r={R}
							fill="none"
							stroke={it.color}
							strokeWidth="36"
							strokeDasharray={`${Math.max(0, lens[i] - gap)} ${C}`}
							strokeDashoffset={-offsets[i]}
							opacity={active && active !== it.id ? 0.35 : 1}
							onMouseEnter={() => onHover(it.id)}
							onMouseLeave={() => onHover(null)}
						/>
					))}
				</g>
				<circle cx="110" cy="110" r="58" fill="var(--cd-sunk)" />
			</svg>
			<div className="apex-mk-donut__c">
				<small>{focus?.name}</small>
				<b>{total > 0 ? fmtPct(num(focus?.value) / total, 0) : '-'}</b>
			</div>
		</div>
	);
}

export default function MarketsInsights({ rows, rowsPrev, loadingPrev, colorFor }) {
	const [hovered, setHovered] = useState(null);

	const prevById = useMemo(
		() => new Map((rowsPrev || []).map((r) => [String(r.marketId), r])),
		[rowsPrev]
	);

	const data = useMemo(() => {
		const list = (rows || []).filter((r) => !r.isStoreTotal);
		const revTotal = list.reduce((s, r) => s + num(r.netRevenue), 0);
		const spendTotal = list.reduce((s, r) => s + num(r.totalMarketingSpend), 0);
		const enriched = list.map((r) => {
			const revShare = revTotal > 0 ? num(r.netRevenue) / revTotal : 0;
			const spendShare = spendTotal > 0 ? num(r.totalMarketingSpend) / spendTotal : 0;
			return {
				...r,
				color: colorFor(r.marketId),
				revShare,
				spendShare,
				efficiency: spendShare > 0 ? revShare / spendShare : NaN,
				margin: num(r.netRevenue) > 0 ? num(r.netProfit) / num(r.netRevenue) : NaN,
				profitPerOrder: num(r.orders) > 0 ? num(r.netProfit) / num(r.orders) : NaN,
				status: marketStatus(r),
				prev: prevById.get(String(r.marketId)) || null,
			};
		});
		const byRevenue = [...enriched].sort((a, b) => num(b.netRevenue) - num(a.netRevenue));
		const withSpend = enriched.filter((r) => num(r.totalMarketingSpend) > 0);
		const bestRoas = [...withSpend].sort((a, b) => num(b.roas) - num(a.roas))[0] || null;
		const weakestPoas = [...withSpend].sort((a, b) => num(a.poas) - num(b.poas))[0] || null;
		const inProfit = enriched.filter((r) => num(r.netProfit) > 0);
		return { list: byRevenue, revTotal, spendTotal, bestRoas, weakestPoas, inProfit };
	}, [rows, colorFor, prevById]);

	if (!data.list.length) return null;
	const top = data.list[0];
	const lossMarkets = data.list.filter((r) => num(r.netProfit) <= 0);

	return (
		<>
			<div className="apex-ov-grid apex-ov-grid--hero apex-mk-row">
				<div className="apex-ov-card apex-ov-kpi is-hero apex-mk-kpi">
					<div className="apex-ov-kpi__label">
						<span>Top market</span>
						<FiEye className="apex-ov-kpi__eye" aria-hidden />
					</div>
					<div className="apex-mk-hero-name">
						<i className="apex-mk-swatch" style={{ background: top.color }} aria-hidden />
						{top.marketName}
					</div>
					<div className="apex-ov-kpi__value">
						{fmtInt(top.netRevenue)}
						<small>kr.</small>
					</div>
					<div className="apex-ov-kpi__row">
						<Growth cur={top.netRevenue} prev={top.prev?.netRevenue} />
						<span className="apex-ov-vs">
							{fmtPct(top.revShare, 0)} of net revenue{top.prev ? ', vs last period' : ''}
						</span>
					</div>
				</div>

				<div className="apex-ov-card apex-ov-kpi apex-mk-kpi">
					<div className="apex-ov-kpi__label">
						<span className="apex-ov-ic"><FiCheckCircle aria-hidden /></span>
						<span>Markets in profit</span>
					</div>
					<div className="apex-ov-kpi__value">
						{data.inProfit.length}
						<small>of {data.list.length}</small>
					</div>
					<div className="apex-ov-kpi__row">
						<span className="apex-ov-vs">
							{lossMarkets.length
								? `Net loss: ${lossMarkets.map((r) => r.marketName).join(', ')}`
								: 'Every market makes a net profit'}
						</span>
					</div>
				</div>

				<div className="apex-ov-card apex-ov-kpi apex-mk-kpi">
					<div className="apex-ov-kpi__label">
						<span className="apex-ov-ic"><FiBarChart2 aria-hidden /></span>
						<span>Best ROAS</span>
					</div>
					<div className="apex-ov-kpi__value">{fmtRatio(data.bestRoas?.roas)}</div>
					<div className="apex-ov-kpi__row">
						{data.bestRoas ? <Growth cur={data.bestRoas.roas} prev={data.bestRoas.prev?.roas} /> : null}
						<span className="apex-ov-vs">{data.bestRoas?.marketName || 'No ad spend'}</span>
					</div>
				</div>

				<div className="apex-ov-card apex-ov-kpi apex-mk-kpi">
					<div className="apex-ov-kpi__label">
						<span className="apex-ov-ic is-cost"><FiAlertTriangle aria-hidden /></span>
						<span>Weakest POAS</span>
					</div>
					<div className="apex-ov-kpi__value">{fmtRatio(data.weakestPoas?.poas)}</div>
					<div className="apex-ov-kpi__row">
						{data.weakestPoas ? <Growth cur={data.weakestPoas.poas} prev={data.weakestPoas.prev?.poas} /> : null}
						<span className="apex-ov-vs">
							{data.weakestPoas ? `${data.weakestPoas.marketName}, break-even is 1,00` : 'No ad spend'}
						</span>
					</div>
				</div>
			</div>

			<div className="apex-ov-grid apex-mk-split apex-mk-row">
				<section className="apex-ov-card">
					<div className="apex-ov-card__head">
						<h3>Revenue share vs spend share</h3>
						<span className="apex-ov-sub">Efficiency index = revenue share / spend share</span>
					</div>
					<div className="apex-mk-share">
						{data.list.map((r) => {
							const tag = efficiencyTag(r.efficiency);
							return (
								<div
									key={r.marketId}
									className={`apex-mk-share__row${hovered === r.marketId ? ' is-hover' : ''}`}
									onMouseEnter={() => setHovered(r.marketId)}
									onMouseLeave={() => setHovered(null)}
								>
									<div className="apex-mk-share__top">
										<span className="apex-mk-share__name">
											<i className="apex-mk-swatch" style={{ background: r.color }} aria-hidden />
											{r.marketName}
										</span>
										<span className="apex-mk-share__meta">
											<b>{Number.isFinite(r.efficiency) ? fmtRatio(r.efficiency) : '-'}</b>
											{tag ? <span className={`apex-mk-tag is-${tag.tone}`}>{tag.label}</span> : null}
										</span>
									</div>
									<div className="apex-mk-share__bars">
										<span className="apex-mk-share__lbl">Revenue</span>
										<div className="apex-ov-bar"><i style={{ width: `${r.revShare * 100}%`, background: r.color }} /></div>
										<span className="apex-mk-share__val">{fmtPct(r.revShare)}</span>
										<span className="apex-mk-share__lbl">Spend</span>
										<div className="apex-ov-bar"><i className="is-spend" style={{ width: `${r.spendShare * 100}%` }} /></div>
										<span className="apex-mk-share__val">{fmtPct(r.spendShare)}</span>
									</div>
								</div>
							);
						})}
					</div>
					<p className="apex-mk-note">
						Above 1,00 a market earns a bigger slice of revenue than the slice of ad budget it gets.
					</p>
				</section>

				<section className="apex-ov-card">
					<div className="apex-ov-card__head">
						<h3>Net revenue by market</h3>
						<span className="apex-ov-sub">{fmtInt(data.revTotal)} kr.</span>
					</div>
					<div className="apex-mk-donut-wrap">
						<Donut
							items={data.list.map((r) => ({ id: r.marketId, name: r.marketName, value: num(r.netRevenue), color: r.color }))}
							total={data.revTotal}
							active={hovered}
							onHover={setHovered}
						/>
						<div className="apex-mk-list">
							{data.list.map((r) => (
								<div
									key={r.marketId}
									className={`apex-mk-li${hovered === r.marketId ? ' is-hover' : ''}`}
									onMouseEnter={() => setHovered(r.marketId)}
									onMouseLeave={() => setHovered(null)}
								>
									<i className="apex-mk-swatch" style={{ background: r.color }} aria-hidden />
									<span className="apex-mk-li__name" title={r.marketName}>{r.marketName}</span>
									<span className="apex-mk-li__amt">{fmtInt(r.netRevenue)} kr.</span>
									<span className="apex-mk-li__pc">{fmtPct(r.revShare, 0)}</span>
								</div>
							))}
						</div>
					</div>
				</section>
			</div>

			<section className="apex-ov-card apex-mk-row">
				<div className="apex-ov-card__head">
					<h3>Market scorecard</h3>
					<span className="apex-ov-sub">
						{loadingPrev ? 'Loading growth vs last period' : 'Growth is vs the previous period of the same length'}
					</span>
				</div>
				<div className="apex-mk-tbl-wrap">
					<table className="apex-mk-tbl">
						<thead>
							<tr>
								<th>Market</th>
								<th>Net revenue</th>
								<th>Growth</th>
								<th>Share</th>
								<th>Orders</th>
								<th>AOV</th>
								<th>Ad spend</th>
								<th>ROAS</th>
								<th>POAS</th>
								<th>Net profit</th>
								<th>Margin</th>
								<th>Profit per order</th>
								<th>Status</th>
							</tr>
						</thead>
						<tbody>
							{data.list.map((r) => (
								<tr key={r.marketId}>
									<td>
										<span className="apex-mk-share__name">
											<i className="apex-mk-swatch" style={{ background: r.color }} aria-hidden />
											{r.marketName}
										</span>
									</td>
									<td>{fmtInt(r.netRevenue)} kr.</td>
									<td>{r.prev ? <Growth cur={r.netRevenue} prev={r.prev.netRevenue} className="is-compact" /> : <span className="apex-mk-muted">-</span>}</td>
									<td>{fmtPct(r.revShare)}</td>
									<td>{fmtInt(r.orders)}</td>
									<td>{fmtInt(r.aov)} kr.</td>
									<td>{fmtInt(r.totalMarketingSpend)} kr.</td>
									<td>{fmtRatio(r.roas)}</td>
									<td>{fmtRatio(r.poas)}</td>
									<td className={num(r.netProfit) < 0 ? 'is-neg' : undefined}>{fmtInt(r.netProfit)} kr.</td>
									<td className={r.margin < 0 ? 'is-neg' : undefined}>{fmtPct(r.margin)}</td>
									<td className={r.profitPerOrder < 0 ? 'is-neg' : undefined}>
										{Number.isFinite(r.profitPerOrder) ? `${fmtInt(r.profitPerOrder)} kr.` : '-'}
									</td>
									<td><span className={`apex-mk-tag is-${r.status.tone}`}>{r.status.label}</span></td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<p className="apex-mk-note">
					Status uses POAS (gross profit per krone of ad spend, break-even 1,00) and net profit. Fixed expenses are split evenly across markets.
				</p>
			</section>
		</>
	);
}

/** One-sentence lede for the heading, from the included markets. */
export function marketsLede(rows) {
	const list = (rows || []).filter((r) => !r.isStoreTotal);
	if (!list.length) return null;
	const revTotal = list.reduce((s, r) => s + num(r.netRevenue), 0);
	const top = [...list].sort((a, b) => num(b.netRevenue) - num(a.netRevenue))[0];
	const share = revTotal > 0 ? num(top.netRevenue) / revTotal : 0;
	const weakest = [...list].filter((r) => num(r.totalMarketingSpend) > 0).sort((a, b) => num(a.netProfit) - num(b.netProfit))[0];
	let out = `${top.marketName} brings in ${fmtPct(share, 0)} of net revenue at ROAS ${fmtRatio(top.roas)}.`;
	if (weakest && weakest.marketId !== top.marketId) {
		out += num(weakest.netProfit) < 0
			? ` ${weakest.marketName} runs at a net loss of ${fmtInt(Math.abs(num(weakest.netProfit)))} kr.`
			: ` ${weakest.marketName} has the lowest net profit at ${fmtInt(weakest.netProfit)} kr.`;
	}
	return out;
}
