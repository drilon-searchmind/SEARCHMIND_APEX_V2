"use client";

import React, { useMemo } from "react";
import moment from "moment";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import {
	LINE_ITEM_STATUS_STYLES,
	defaultLineItemStatusStyle,
	normalizeLineItemStatus,
} from "../lib/lineItemStatus";

function clipRangeToYear(startM, endExclusiveM, year) {
	const yStart = moment(`${year}-01-01`).startOf("day");
	const yEndEx = moment(`${year}-12-31`).startOf("day").add(1, "day");
	if (!startM?.isValid()) return null;
	const s = moment.max(startM.clone().startOf("day"), yStart);
	const e = endExclusiveM?.isValid()
		? moment.min(endExclusiveM.clone(), yEndEx)
		: yEndEx;
	if (!e.isAfter(s)) return null;
	return { start: s, endExclusive: e };
}

function parentRangeForYear(parent, year) {
	const startM = parent.startDate
		? moment(parent.startDate).startOf("day")
		: parent.createdAt
			? moment(parent.createdAt).startOf("day")
			: null;
	if (!startM?.isValid()) return null;
	let endExclusive;
	if (parent.alwaysOn) {
		endExclusive = yEndExclusive(year);
	} else if (parent.endDate) {
		endExclusive = moment(parent.endDate).startOf("day").add(1, "day");
	} else {
		endExclusive = startM.clone().add(1, "day");
	}
	return clipRangeToYear(startM, endExclusive, year);
}

function yEndExclusive(year) {
	return moment(`${year}-12-31`).startOf("day").add(1, "day");
}

function lineRangeForYear(li, year) {
	if (!li.startDate) return null;
	const startM = moment(li.startDate).startOf("day");
	let endExclusive;
	if (li.alwaysOn) {
		endExclusive = yEndExclusive(year);
	} else if (li.endDate) {
		endExclusive = moment(li.endDate).startOf("day").add(1, "day");
	} else {
		endExclusive = startM.clone().add(1, "day");
	}
	return clipRangeToYear(startM, endExclusive, year);
}

function barMetrics(range, year) {
	const yStart = moment(`${year}-01-01`).startOf("day");
	const yEndEx = yEndExclusive(year);
	const totalDays = Math.max(1, yEndEx.diff(yStart, "days"));
	const s = range.start;
	const e = range.endExclusive;
	const startOffset = Math.max(0, s.diff(yStart, "days"));
	const span = Math.max(1, e.diff(s, "days"));
	return {
		leftPct: (startOffset / totalDays) * 100,
		widthPct: Math.min(100, (span / totalDays) * 100),
	};
}

export default function PlannerV2Gantt({
	parents = [],
	lineItemsWithContext = [],
	year,
	onYearChange,
	onSelectParent,
	onSelectLineItem,
	embedded = false,
}) {
	const monthTicks = useMemo(() => {
		const yStart = moment(`${year}-01-01`);
		return Array.from({ length: 12 }, (_, i) =>
			yStart.clone().add(i, "month").format("MMM")
		);
	}, [year]);

	const rows = useMemo(() => {
		const list = [];
		parents.forEach((p) => {
			const pr = parentRangeForYear(p, year);
			if (!pr) return;
			list.push({
				key: `parent-${p.id}`,
				kind: "parent",
				label: p.campaignName || "Campaign",
				sub: "Campaign",
				parent: p,
				range: pr,
				color: "var(--perf-accent)",
				border: "var(--color-accent)",
			});
		});
		lineItemsWithContext.forEach((li) => {
			const lr = lineRangeForYear(li, year);
			if (!lr) return;
			const st = normalizeLineItemStatus(li.status);
			const pal = LINE_ITEM_STATUS_STYLES[st] || defaultLineItemStatusStyle();
			const parentPart = li._parentName ? `${li._parentName} · ` : "";
			list.push({
				key: `line-${li.id}`,
				kind: "lineItem",
				label: `${parentPart}${li.name}`,
				sub: st,
				lineItem: li,
				range: lr,
				color: pal.bg,
				border: pal.border,
			});
		});
		return list;
	}, [parents, lineItemsWithContext, year]);

	return (
		<section
			className={`apex-cp-schedule-panel ${embedded ? "mt-0" : "mt-10"}`}
			aria-labelledby="planner-v2-gantt-heading"
		>
			<div className="apex-cp-schedule-head">
				<div>
					<h2
						id="planner-v2-gantt-heading"
						className="apex-cp-schedule-head__title"
					>
						Gantt
					</h2>
					<p className="apex-cp-schedule-head__subtitle">
						Campaign and campaign-type spans for the selected year. Click a bar
						to edit.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => onYearChange?.(year - 1)}
						className="apex-cp-icon-btn"
						aria-label="Previous year"
					>
						<FiChevronLeft className="w-5 h-5" />
					</button>
					<span className="text-sm font-semibold text-[var(--color-ink)] tabular-nums min-w-[3.5rem] text-center">
						{year}
					</span>
					<button
						type="button"
						onClick={() => onYearChange?.(year + 1)}
						className="apex-cp-icon-btn"
						aria-label="Next year"
					>
						<FiChevronRight className="w-5 h-5" />
					</button>
				</div>
			</div>

			<div className="apex-cp-gantt-grid">
				<div
					className="apex-cp-gantt-head"
					style={{
						gridTemplateColumns: "minmax(200px,240px) repeat(12, 1fr)",
					}}
				>
					<div className="apex-cp-gantt-head__label">Name</div>
					{monthTicks.map((m) => (
						<div key={m} className="apex-cp-gantt-head__month">
							{m}
						</div>
					))}
				</div>
				<div className="max-h-[560px] overflow-y-auto">
					{rows.length === 0 ? (
						<div className="apex-cp-schedule-empty py-16">
							No rows with dates in {year}.
						</div>
					) : (
						rows.map((row) => {
							const { leftPct, widthPct } = row.range
								? barMetrics(row.range, year)
								: { leftPct: 0, widthPct: 0 };
							return (
								<div
									key={row.key}
									className="apex-cp-gantt-row"
									style={{
										gridTemplateColumns: "minmax(200px, 240px) 1fr",
									}}
								>
									<button
										type="button"
										className="apex-cp-gantt-row__label"
										onClick={() => {
											if (row.kind === "parent" && row.parent)
												onSelectParent?.(row.parent);
											if (row.kind === "lineItem" && row.lineItem)
												onSelectLineItem?.(row.lineItem);
										}}
									>
										<div className="font-medium truncate">{row.label}</div>
										<div className="text-xs text-[var(--color-muted)] truncate">
											{row.sub}
										</div>
									</button>
									<div className="apex-cp-gantt-track relative py-2 pr-2 pl-0">
										<div
											className="absolute inset-y-0 left-0 right-2 flex pointer-events-none"
											aria-hidden
										>
											{monthTicks.map((m) => (
												<div
													key={m}
													className="flex-1 border-l border-[var(--color-rule)]"
												/>
											))}
										</div>
										{row.range && (
											<button
												type="button"
												onClick={() => {
													if (row.kind === "parent" && row.parent)
														onSelectParent?.(row.parent);
													if (row.kind === "lineItem" && row.lineItem)
														onSelectLineItem?.(row.lineItem);
												}}
												className="apex-cp-gantt-bar text-left px-2 text-[11px] font-medium text-[var(--color-ink)] truncate hover:opacity-90 z-[1]"
												style={{
													marginLeft: `${leftPct}%`,
													width: `${widthPct}%`,
													backgroundColor: row.color,
													borderColor: row.border,
													border: `1px solid ${row.border}`,
												}}
												title={row.label}
											>
												<span className="truncate block">{row.label}</span>
											</button>
										)}
									</div>
								</div>
							);
						})
					)}
				</div>
			</div>
		</section>
	);
}
