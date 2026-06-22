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
			<div className="apex-cp-detail__label">{label}</div>
			<div className="apex-cp-detail__value">{children}</div>
		</div>
	);
}

function SectionRule({ title }) {
	return (
		<div className="apex-cp-section-rule">
			<div className="apex-cp-section-rule__line" />
			<span className="apex-cp-section-rule__title">{title}</span>
			<div className="apex-cp-section-rule__line" />
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
				className={`apex-cp-parent-card ${
					groundedStyle ? "apex-cp-parent-card--ended" : ""
				}`}
			>
				<div className="apex-cp-parent-card__head">
					<button
						type="button"
						onClick={() => toggle(parent.id)}
						className="apex-cp-parent-card__toggle"
						aria-expanded={!!isOpen}
					>
						{isOpen ? (
							<FiChevronDown className="w-5 h-5" />
						) : (
							<FiChevronRight className="w-5 h-5" />
						)}
						<span className="apex-cp-parent-card__name">
							{parent.campaignName}
						</span>
					</button>
					{groundedStyle && (
						<span className="apex-cp-badge apex-cp-badge--ended">Ended</span>
					)}
					{overBudget && (
						<span className="apex-cp-badge apex-cp-badge--warn">
							<FiAlertTriangle className="w-3.5 h-3.5" />
							Over budget
						</span>
					)}
					<span className="apex-cp-parent-card__meta">
						{parent.alwaysOn
							? "Always on"
							: `${formatDate(parent.startDate)} – ${formatDate(parent.endDate)}`}
					</span>
					{hasCap && (
						<span
							className={`text-xs sm:text-sm ${
								overBudget
									? "text-[var(--color-ink)] font-medium"
									: "text-[var(--color-muted)]"
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
							className="apex-cp-link"
						>
							<FiExternalLink className="w-4 h-4" />
							Material
						</a>
					)}
					<div className="ml-auto flex items-center gap-2">
						<button
							type="button"
							onClick={() => onEditParent(parent)}
							className="apex-cp-icon-btn"
							title="Edit campaign"
						>
							<FiEdit2 className="w-4 h-4" />
						</button>
						<button
							type="button"
							onClick={() => onDeleteParent(parent.id)}
							className="apex-cp-icon-btn apex-cp-icon-btn--danger"
							title="Delete campaign"
						>
							<FiTrash2 className="w-4 h-4" />
						</button>
					</div>
				</div>

				{isOpen && (
					<div className="p-4 overflow-x-auto">
						<div className="apex-cp-inner-panel">
							<h4 className="apex-cp-inner-panel__title">Campaign details</h4>
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
											className="apex-cp-link break-all"
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
								<div className="mt-4 pt-4 border-t border-[var(--color-rule)]">
									<h5 className="apex-cp-inner-panel__title">Service budget allocation</h5>
									<div className="flex flex-wrap items-baseline justify-between gap-2 text-sm mb-2">
										<span>
											<span className="text-[var(--color-muted)]">Allocated: </span>
											<span className="font-semibold text-[var(--color-ink)]">
												{formatBudgetAmount(allocated, currency)}
											</span>
										</span>
										<span>
											<span className="text-[var(--color-muted)]">Campaign cap: </span>
											<span className="font-semibold text-[var(--color-ink)]">
												{formatBudgetAmount(cap, currency)}
											</span>
										</span>
									</div>
									{allocated > 0 && (
										<div className="mt-2">
											<div
												className="h-2.5 rounded-full bg-[var(--perf-canvas)] overflow-hidden flex w-full border border-[var(--color-rule)]"
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
											<div className="mt-1 flex flex-wrap gap-3 text-xs text-[var(--color-muted)]">
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
												<div className="mt-2 flex items-start gap-2 rounded-md apex-cp-badge apex-cp-badge--warn text-sm px-3 py-2">
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
								<div key={svc.id} className="apex-cp-service-card">
									<div
										className="apex-cp-service-card__head"
										style={{
											backgroundColor: groundedStyle
												? "#ffedd5"
												: SERVICE_COLORS[svc.serviceName] || "#e5e7eb",
										}}
									>
										<span className="font-semibold text-sm text-[var(--color-ink)]">
											{svc.serviceName}
										</span>
										{hasCap &&
											svc.budget != null &&
											!Number.isNaN(Number(svc.budget)) &&
											Number(svc.budget) > 0 && (
												<span className="text-sm text-[var(--color-ink-2)]">
													Budget{" "}
													<span className="font-medium tabular-nums">
														{formatBudgetAmount(Number(svc.budget), currency)}
													</span>
												</span>
											)}
									</div>
									<div className="apex-cp-service-card__body">
										{hasCap && (
											<div className="flex flex-wrap items-center gap-3 pb-2 mb-1 border-b border-[var(--color-rule)] text-xs text-[var(--color-muted)]">
												<label className="inline-flex items-center gap-2">
													<span>Service budget</span>
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
															className="apex-cp-select w-28 h-8 tabular-nums"
														/>
														<span>{currency}</span>
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
														className="apex-cp-status-group"
													>
														<div className="apex-cp-status-group__label">
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
																		className={`apex-cp-line-item ${
																			lineEnded ? "apex-cp-line-item--ended" : ""
																		}`}
																	>
																		<div className="min-w-0 flex-1 flex flex-col">
																			<button
																				type="button"
																				onClick={() => onEditLineItem(li, svc)}
																				className="apex-cp-line-item__main"
																			>
																				<div className="apex-cp-line-item__title">
																					{li.name}
																				</div>
																				<div className="apex-cp-line-item__sub">
																					{[li.media, lineFormatsLabel(li)]
																						.filter(Boolean)
																						.join(" · ") || "—"}
																				</div>
																				<div className="apex-cp-line-item__sub">
																					{lineItemDateRangeLabel(li)}
																				</div>
																				{hasCap &&
																					li.budget != null &&
																					!Number.isNaN(Number(li.budget)) &&
																					Number(li.budget) > 0 && (
																						<div className="apex-cp-line-item__sub">
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
																						className="apex-cp-select text-xs font-semibold max-w-[min(100%,15rem)] cursor-pointer"
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
																						className="apex-cp-link"
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
																					className="apex-cp-icon-btn"
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
																				className="apex-cp-icon-btn apex-cp-icon-btn--danger"
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
											className="apex-cp-add-btn"
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
							<div className="mt-4 grid md:grid-cols-2 gap-3">
								{parent.brief && (
									<div className="apex-cp-brief">
										<div className="apex-cp-brief__label">Brief</div>
										<p className="whitespace-pre-wrap text-[var(--color-ink-2)]">
											{parent.brief}
										</p>
									</div>
								)}
								{parent.furtherBrief && (
									<div className="apex-cp-brief">
										<div className="apex-cp-brief__label">Further brief</div>
										<p className="whitespace-pre-wrap text-[var(--color-ink-2)]">
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
			<div className="apex-cp-empty">
				{filteredOut ? (
					<>
						<strong>No campaigns match your filters.</strong>
						Reset filters or broaden the period to see campaigns again.
					</>
				) : (
					"No campaigns yet. Create one using the button above."
				)}
			</div>
		);
	}

	return (
		<div className="apex-cp-overview">
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
