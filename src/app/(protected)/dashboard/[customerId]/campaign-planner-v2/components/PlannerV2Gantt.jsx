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
				color: "rgba(59, 130, 246, 0.35)",
				border: "rgba(37, 99, 235, 0.8)",
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
			className={`${embedded ? "mt-0" : "mt-10"} rounded-xl border border-gray-200 bg-gray-100 p-4 md:p-6`}
			aria-labelledby="planner-v2-gantt-heading"
		>
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
				<div>
					<h2
						id="planner-v2-gantt-heading"
						className="text-lg font-semibold text-gray-900"
					>
						Gantt
					</h2>
					<p className="text-sm text-gray-600 mt-0.5">
						Campaign and campaign-type spans for the selected year. Click a bar
						to edit.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => onYearChange?.(year - 1)}
						className="p-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
						aria-label="Previous year"
					>
						<FiChevronLeft className="w-5 h-5" />
					</button>
					<span className="text-sm font-semibold text-gray-900 tabular-nums min-w-[3.5rem] text-center">
						{year}
					</span>
					<button
						type="button"
						onClick={() => onYearChange?.(year + 1)}
						className="p-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
						aria-label="Next year"
					>
						<FiChevronRight className="w-5 h-5" />
					</button>
				</div>
			</div>

			<div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
				<div
					className="grid text-xs text-gray-500 border-b border-gray-200 bg-gray-50"
					style={{
						gridTemplateColumns: "minmax(200px,240px) repeat(12, 1fr)",
					}}
				>
					<div className="px-3 py-2 font-medium text-gray-700">Name</div>
					{monthTicks.map((m) => (
						<div key={m} className="px-1 py-2 text-center border-l border-gray-100">
							{m}
						</div>
					))}
				</div>
				<div className="max-h-[560px] overflow-y-auto">
					{rows.length === 0 ? (
						<div className="py-16 text-center text-gray-500 text-sm">
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
									className="grid border-b border-gray-100 items-stretch min-h-[44px]"
									style={{
										gridTemplateColumns: "minmax(200px, 240px) 1fr",
									}}
								>
									<button
										type="button"
										className="text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-50 border-r border-gray-100"
										onClick={() => {
											if (row.kind === "parent" && row.parent)
												onSelectParent?.(row.parent);
											if (row.kind === "lineItem" && row.lineItem)
												onSelectLineItem?.(row.lineItem);
										}}
									>
										<div className="font-medium truncate">{row.label}</div>
										<div className="text-xs text-gray-500 truncate">{row.sub}</div>
									</button>
									<div className="relative py-2 pr-2 pl-0">
										<div
											className="absolute inset-y-0 left-0 right-2 flex pointer-events-none"
											aria-hidden
										>
											{monthTicks.map((m) => (
												<div
													key={m}
													className="flex-1 border-l border-gray-100/90"
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
												className="relative h-6 mt-1 rounded border text-left px-2 text-[11px] font-medium text-gray-900 truncate hover:opacity-90 z-[1]"
												style={{
													marginLeft: `${leftPct}%`,
													width: `${widthPct}%`,
													backgroundColor: row.color,
													borderColor: row.border,
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
