"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
	FiAlertTriangle,
	FiBarChart2,
	FiChevronDown,
	FiChevronRight,
	FiCopy,
	FiEdit2,
	FiExternalLink,
	FiPlus,
	FiTrash2,
} from "react-icons/fi";
import {
	PLANNER_V2_DEFAULT_CURRENCY,
	SERVICE_COLORS,
	LINE_ITEM_STATUSES,
} from "../constants";
import {
	defaultLineItemStatusStyle,
	isLineItemEndedVisual,
	LINE_ITEM_STATUS_STYLES,
	normalizeLineItemStatus,
} from "../lib/lineItemStatus";
import { formatBudgetAmount } from "../lib/formatBudget";
import { getChannelPerformancePath } from "../lib/channelPerformanceLink";

function startOfToday() {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	return d;
}

/** Ended / grounded campaigns (not “Always on”). */
function isParentCampaignPast(parent) {
	if (parent.alwaysOn) return false;
	if (!parent.endDate) return false;
	const end = new Date(parent.endDate);
	end.setHours(0, 0, 0, 0);
	return end < startOfToday();
}

function formatDate(iso) {
	if (!iso) return "—";
	return new Date(iso).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

function responsibleLabel(value) {
	if (value === "searchmind") return "Searchmind";
	if (value === "kunde") return "Internal";
	return value?.trim() ? value : "—";
}

function lineFormatsLabel(li) {
	const arr =
		Array.isArray(li.formats) && li.formats.length > 0
			? li.formats
			: [li.format].filter(Boolean);
	return arr.length ? arr.join(", ") : "—";
}

function lineItemDateRangeLabel(li) {
	if (li.alwaysOn) {
		const start = li.startDate ? formatDate(li.startDate) : null;
		return start ? `${start} · Always on` : "Always on";
	}
	const a = formatDate(li.startDate);
	const b = formatDate(li.endDate);
	if (a === "—" && b === "—") return "—";
	return `${a} – ${b}`;
}

function Detail({ label, children }) {
	return (
		<div>
			<div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
				{label}
			</div>
			<div className="mt-0.5 text-sm text-gray-900">{children}</div>
		</div>
	);
}

function SectionRule({ title }) {
	return (
		<div className="flex items-center gap-3 py-2">
			<div className="h-px flex-1 bg-gray-300" />
			<span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
				{title}
			</span>
			<div className="h-px flex-1 bg-gray-300" />
		</div>
	);
}

export default function CampaignOverview({
	parents = [],
	storedParentCount,
	services = [],
	lineItems = [],
	customerId,
	onEditParent,
	onDeleteParent,
	onUpdateService,
	onAddLineItem,
	onEditLineItem,
	onDeleteLineItem,
	onDuplicateLineItem,
	onLineItemStatusChange,
}) {
	const [expanded, setExpanded] = useState({});

	const byParent = useMemo(() => {
		const map = {};
		parents.forEach((p) => {
			map[p.id] = {
				services: services.filter((s) => s.parentId === p.id),
			};
		});
		return map;
	}, [parents, services]);

	const lineByService = useMemo(() => {
		const m = {};
		lineItems.forEach((li) => {
			if (!m[li.serviceId]) m[li.serviceId] = [];
			m[li.serviceId].push(li);
		});
		return m;
	}, [lineItems]);

	const { scheduledParents, alwaysOnParents } = useMemo(() => {
		const scheduled = [];
		const always = [];
		for (const p of parents) {
			if (p.alwaysOn) always.push(p);
			else scheduled.push(p);
		}
		return { scheduledParents: scheduled, alwaysOnParents: always };
	}, [parents]);

	const toggle = (id) => {
		setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
	};

	const renderParentCard = (parent) => {
		const past = isParentCampaignPast(parent);
		const groundedStyle = past && !parent.alwaysOn;
		const isOpen = expanded[parent.id];
		const row = byParent[parent.id] || { services: [] };
		const currency =
			parent.budgetCurrency || PLANNER_V2_DEFAULT_CURRENCY;
		const allocated = row.services.reduce(
			(sum, s) => sum + (Number(s.budget) || 0),
			0
		);
		const cap =
			parent.totalBudget != null && !Number.isNaN(Number(parent.totalBudget))
				? Number(parent.totalBudget)
				: null;
		const hasCap = cap != null && cap > 0;
		const overBudget = hasCap && allocated > cap;

		return (
			<div
				key={parent.id}
				className={`rounded-xl border overflow-hidden transition-colors ${
					groundedStyle
						? "border-[#9a3412] bg-[#fff7ed] shadow-[inset_4px_0_0_0_#c2410c]"
						: "border-gray-200 bg-white"
				}`}
			>
				<div
					className={`flex flex-wrap items-center gap-3 p-4 border-b ${
						groundedStyle
							? "border-orange-200/80 bg-orange-50/50"
							: "border-gray-100"
					}`}
				>
					<button
						type="button"
						onClick={() => toggle(parent.id)}
						className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
						aria-expanded={!!isOpen}
					>
						{isOpen ? (
							<FiChevronDown className="w-5 h-5" />
						) : (
							<FiChevronRight className="w-5 h-5" />
						)}
						<span className="font-semibold text-gray-900 text-left">
							{parent.campaignName}
						</span>
					</button>
					{groundedStyle && (
						<span className="text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded bg-[#c2410c]/15 text-[#9a3412] border border-[#c2410c]/30">
							Ended
						</span>
					)}
					{overBudget && (
						<span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
							<FiAlertTriangle className="w-3.5 h-3.5" />
							Over budget
						</span>
					)}
					<span className="text-sm text-gray-500">
						{parent.alwaysOn
							? "Always on"
							: `${formatDate(parent.startDate)} – ${formatDate(parent.endDate)}`}
					</span>
					{hasCap && (
						<span
							className={`text-xs sm:text-sm ${
								overBudget ? "text-amber-800 font-medium" : "text-gray-500"
							}`}
						>
							Allocated {formatBudgetAmount(allocated, currency)}
							{" · "}
							Cap {formatBudgetAmount(cap, currency)}
						</span>
					)}
					{parent.materialLink && (
						<a
							href={parent.materialLink}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1 text-sm text-[var(--color-primary-searchmind)] hover:underline"
						>
							<FiExternalLink className="w-4 h-4" />
							Material
						</a>
					)}
					<div className="ml-auto flex items-center gap-2">
						<button
							type="button"
							onClick={() => onEditParent(parent)}
							className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
							title="Edit campaign"
						>
							<FiEdit2 className="w-4 h-4" />
						</button>
						<button
							type="button"
							onClick={() => onDeleteParent(parent.id)}
							className="p-2 rounded-lg border border-gray-200 text-red-600 hover:bg-red-50"
							title="Delete campaign"
						>
							<FiTrash2 className="w-4 h-4" />
						</button>
					</div>
				</div>

				{isOpen && (
					<div className="p-4 overflow-x-auto">
						<div className="rounded-lg border border-gray-200 bg-gray-50/90 p-4 mb-4">
							<h4 className="text-sm font-semibold text-gray-900 mb-3">
								Campaign details
							</h4>
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
								<Detail label="Responsible">
									{responsibleLabel(parent.responsible)}
								</Detail>
								<Detail label="Country code">
									{parent.countryCode?.trim() || "—"}
								</Detail>
								<Detail label="Audience">
									{parent.audience?.trim() || "—"}
								</Detail>
								{hasCap && (
									<>
										<Detail label="Total budget">
											{formatBudgetAmount(cap, currency)}
										</Detail>
										<Detail label="Currency">{currency}</Detail>
									</>
								)}
								<Detail label="Landing page">
									{parent.landingPageLink?.trim() ? (
										<a
											href={parent.landingPageLink}
											target="_blank"
											rel="noopener noreferrer"
											className="text-[var(--color-primary-searchmind)] hover:underline inline-flex items-center gap-1 break-all"
										>
											{parent.landingPageLink}
											<FiExternalLink className="w-3.5 h-3.5 shrink-0" />
										</a>
									) : (
										"—"
									)}
								</Detail>
							</div>

							{hasCap && (
								<div className="mt-4 pt-4 border-t border-gray-200">
									<h5 className="text-sm font-semibold text-gray-900 mb-2">
										Service budget allocation
									</h5>
									<div className="flex flex-wrap items-baseline justify-between gap-2 text-sm mb-2">
										<span>
											<span className="text-gray-600">Allocated: </span>
											<span className="font-semibold text-gray-900">
												{formatBudgetAmount(allocated, currency)}
											</span>
										</span>
										<span>
											<span className="text-gray-600">Campaign cap: </span>
											<span className="font-semibold text-gray-900">
												{formatBudgetAmount(cap, currency)}
											</span>
										</span>
									</div>
									{allocated > 0 && (
										<div className="mt-2">
											<div
												className="h-2.5 rounded-full bg-gray-200 overflow-hidden flex w-full"
												title="Share of allocated budget by service"
											>
												<div className="flex h-full w-full min-w-0 rounded-full overflow-hidden">
													{row.services.map((s) => {
														const amt = Number(s.budget) || 0;
														if (amt <= 0) return null;
														return (
															<div
																key={s.id}
																className="h-full min-w-0 transition-all"
																style={{
																	flex: amt,
																	backgroundColor:
																		SERVICE_COLORS[s.serviceName] || "#94a3b8",
																}}
																title={`${s.serviceName}: ${formatBudgetAmount(amt, currency)}`}
															/>
														);
													})}
												</div>
											</div>
											<div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-600">
												{row.services.map((s) => (
													<span key={s.id} className="inline-flex items-center gap-1">
														<span
															className="w-2 h-2 rounded-sm shrink-0"
															style={{
																backgroundColor:
																	SERVICE_COLORS[s.serviceName] || "#94a3b8",
															}}
														/>
														{s.serviceName}
													</span>
												))}
											</div>
											{overBudget && (
												<div className="mt-2 flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 text-amber-950 text-sm px-3 py-2">
													<FiAlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
													<span>
														Service budgets exceed the campaign total by{" "}
														<strong>
															{formatBudgetAmount(allocated - cap, currency)}
														</strong>
														.
													</span>
												</div>
											)}
										</div>
									)}
								</div>
							)}
						</div>

						<div className="space-y-3">
							{row.services.map((svc) => (
								<div
									key={svc.id}
									className="border border-gray-200 rounded-lg overflow-hidden bg-white"
								>
									<div
										className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 border-b border-black/5"
										style={{
											backgroundColor: groundedStyle
												? "#ffedd5"
												: SERVICE_COLORS[svc.serviceName] || "#e5e7eb",
										}}
									>
										<span className="font-semibold text-sm text-gray-900">
											{svc.serviceName}
										</span>
										{hasCap &&
											svc.budget != null &&
											!Number.isNaN(Number(svc.budget)) &&
											Number(svc.budget) > 0 && (
												<span className="text-sm text-gray-800">
													Budget{" "}
													<span className="font-medium tabular-nums">
														{formatBudgetAmount(Number(svc.budget), currency)}
													</span>
												</span>
											)}
									</div>
									<div className="px-3 py-3 space-y-2 bg-white">
										{hasCap && (
											<div className="flex flex-wrap items-center gap-3 pb-2 mb-1 border-b border-gray-100 text-xs text-gray-600">
												<label className="inline-flex items-center gap-2">
													<span className="text-gray-500">Service budget</span>
													<span className="inline-flex items-center gap-1">
														<input
															type="number"
															min="0"
															step="1"
															placeholder="—"
															value={svc.budget ?? ""}
															onChange={(e) => {
																const v = e.target.value;
																onUpdateService(svc.id, {
																	budget: v === "" ? null : Number(v),
																});
															}}
															className="w-28 h-8 rounded border border-gray-300 px-2 text-xs tabular-nums bg-white"
														/>
														<span className="text-gray-400">{currency}</span>
													</span>
												</label>
											</div>
										)}
										<div className="space-y-3">
										{(() => {
											const items = lineByService[svc.id] || [];
											const byStatus = {};
										LINE_ITEM_STATUSES.forEach((s) => {
												byStatus[s] = [];
											});
											items.forEach((li) => {
												const st = normalizeLineItemStatus(li.status);
												if (byStatus[st]) byStatus[st].push(li);
												else byStatus["Pending Searchmind"].push(li);
											});
											return LINE_ITEM_STATUSES.map((st) => {
												const group = byStatus[st];
												if (!group.length) return null;
												const stPal =
													LINE_ITEM_STATUS_STYLES[st] ||
													defaultLineItemStatusStyle();
												return (
													<div
														key={`${svc.id}-${st}`}
														className="rounded-lg border border-gray-200 bg-white p-3 space-y-2"
													>
														<div className="flex items-center gap-2 text-xs font-semibold text-gray-800">
															<span
																className="w-2.5 h-2.5 rounded-sm shrink-0"
																style={{
																	backgroundColor: stPal.bg,
																	border: `1px solid ${stPal.border}`,
																}}
															/>
															{st}
														</div>
														<div className="space-y-2">
															{group.map((li) => {
																const lineEnded = isLineItemEndedVisual(li);
																const performanceHref =
																	customerId &&
																	getChannelPerformancePath({
																		customerId,
																		serviceName: svc.serviceName,
																		media: li.media,
																		lineName: li.name,
																		startDate: li.startDate,
																		endDate: li.endDate,
																	});
																const lineStPal =
																	LINE_ITEM_STATUS_STYLES[
																		normalizeLineItemStatus(li.status)
																	] || defaultLineItemStatusStyle();
																return (
																	<div
																		key={li.id}
																		className={`flex items-stretch gap-2 rounded-lg border bg-white hover:border-[var(--color-primary-searchmind)]/50 transition-colors ${
																			lineEnded
																				? "border-[#9a3412] border-l-4 border-l-[#c2410c] bg-[#fff7ed]/60"
																				: "border-gray-200"
																		}`}
																	>
																		<div className="min-w-0 flex-1 flex flex-col">
																			<button
																				type="button"
																				onClick={() => onEditLineItem(li, svc)}
																				className="text-left w-full px-3 py-2 flex flex-col gap-0.5"
																			>
																				<div className="font-medium text-sm text-gray-900">
																					{li.name}
																				</div>
																				<div className="text-xs text-gray-600">
																					{[li.media, lineFormatsLabel(li)]
																						.filter(Boolean)
																						.join(" · ") || "—"}
																				</div>
																				<div className="text-xs text-gray-500">
																					{lineItemDateRangeLabel(li)}
																				</div>
																				{hasCap &&
																					li.budget != null &&
																					!Number.isNaN(Number(li.budget)) &&
																					Number(li.budget) > 0 && (
																						<div className="text-xs text-gray-600">
																							{formatBudgetAmount(
																								Number(li.budget),
																								currency
																							)}
																						</div>
																					)}
																			</button>
																			<div className="flex flex-wrap items-center gap-2 px-3 pb-2">
																				{onLineItemStatusChange && (
																					<select
																						aria-label={`Status for ${li.name}`}
																						value={normalizeLineItemStatus(li.status)}
																						onClick={(e) => e.stopPropagation()}
																						onChange={(e) => {
																							e.stopPropagation();
																							onLineItemStatusChange(
																								li.id,
																								e.target.value
																							);
																						}}
																						className="text-xs font-semibold rounded-md border-2 pl-2 pr-7 py-1.5 max-w-[min(100%,15rem)] cursor-pointer"
																						style={{
																							backgroundColor: lineStPal.bg,
																							borderColor: lineStPal.border,
																							color: "#0f172a",
																						}}
																					>
																						{LINE_ITEM_STATUSES.map((s) => (
																							<option key={s} value={s}>
																								{s}
																							</option>
																						))}
																					</select>
																				)}
																				{performanceHref && (
																					<Link
																						href={performanceHref}
																						className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary-searchmind)] hover:underline"
																						onClick={(e) => e.stopPropagation()}
																					>
																						<FiBarChart2 className="w-3.5 h-3.5" />
																						Channel performance
																					</Link>
																				)}
																			</div>
																		</div>
																		<div className="flex flex-col justify-center shrink-0 pr-1 gap-1">
																			{onDuplicateLineItem && (
																				<button
																					type="button"
																					onClick={(e) => {
																						e.stopPropagation();
																						onDuplicateLineItem(li);
																					}}
																					className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
																					title="Duplicate"
																				>
																					<FiCopy className="w-4 h-4" />
																				</button>
																			)}
																			<button
																				type="button"
																				onClick={(e) => {
																					e.stopPropagation();
																					onDeleteLineItem(li.id);
																				}}
																				className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
																				title="Delete"
																			>
																				<FiTrash2 className="w-4 h-4" />
																			</button>
																		</div>
																	</div>
																);
															})}
														</div>
													</div>
												);
											});
										})()}
										<button
											type="button"
											onClick={() => onAddLineItem(svc)}
											className="w-full flex items-center justify-center gap-1 py-2 rounded-lg border border-dashed border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
										>
											<FiPlus className="w-4 h-4" />
											Campaign type
										</button>
										</div>
									</div>
								</div>
							))}
						</div>

						{(parent.brief || parent.furtherBrief) && (
							<div className="mt-4 grid md:grid-cols-2 gap-3 text-sm">
								{parent.brief && (
									<div className="rounded-lg bg-white border border-gray-100 p-3">
										<div className="text-xs font-semibold text-gray-500 mb-1">
											Brief
										</div>
										<p className="text-gray-800 whitespace-pre-wrap">
											{parent.brief}
										</p>
									</div>
								)}
								{parent.furtherBrief && (
									<div className="rounded-lg bg-white border border-gray-100 p-3">
										<div className="text-xs font-semibold text-gray-500 mb-1">
											Further brief
										</div>
										<p className="text-gray-800 whitespace-pre-wrap">
											{parent.furtherBrief}
										</p>
									</div>
								)}
							</div>
						)}
					</div>
				)}
			</div>
		);
	};

	if (parents.length === 0) {
		const filteredOut =
			typeof storedParentCount === "number" && storedParentCount > 0;
		return (
			<div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-500">
				{filteredOut ? (
					<>
						<p className="text-gray-700 font-medium">
							No campaigns match your filters.
						</p>
						<p className="mt-2 text-sm">
							Reset filters or broaden the period to see campaigns again.
						</p>
					</>
				) : (
					"No campaigns yet. Create one using the button above."
				)}
			</div>
		);
	}

	return (
		<div className="space-y-4 bg-gray-100 rounded-xl p-4">
			{scheduledParents.length > 0 && (
				<>
					<SectionRule title="Campaigns" />
					<div className="space-y-4">
						{scheduledParents.map((p) => renderParentCard(p))}
					</div>
				</>
			)}

			{alwaysOnParents.length > 0 && (
				<>
					<SectionRule title="Always on" />
					<div className="space-y-4">
						{alwaysOnParents.map((p) => renderParentCard(p))}
					</div>
				</>
			)}
		</div>
	);
}
