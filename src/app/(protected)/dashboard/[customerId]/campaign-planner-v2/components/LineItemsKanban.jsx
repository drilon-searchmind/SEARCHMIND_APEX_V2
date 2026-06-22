"use client";

import React, { useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { LINE_ITEM_STATUSES, SERVICE_COLORS } from "../constants";
import {
	LINE_ITEM_STATUS_STYLES,
	defaultLineItemStatusStyle,
	normalizeLineItemStatus,
} from "../lib/lineItemStatus";

function startOfToday() {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	return d;
}

function isLineItemEnded(item) {
	if (item.status === "Ended") return true;
	if (item.alwaysOn) return false;
	if (!item.endDate) return false;
	const end = new Date(item.endDate);
	end.setHours(0, 0, 0, 0);
	return end < startOfToday();
}

function formatIsoDate(iso) {
	if (!iso) return "—";
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

export default function LineItemsKanban({
	lineItemsWithContext = [],
	onStatusChange,
	onOpenLineItem,
	filterDateRange,
}) {
	const { activeByStatus, endedItems } = useMemo(() => {
		const activeStatuses = LINE_ITEM_STATUSES.filter((s) => s !== "Ended");
		const activeByStatus = {};
		activeStatuses.forEach((s) => {
			activeByStatus[s] = [];
		});
		const endedItems = [];

		lineItemsWithContext.forEach((item) => {
			const syntheticEnded = isLineItemEnded(item);
			const norm = normalizeLineItemStatus(item.status);
			if (syntheticEnded || norm === "Ended") {
				endedItems.push({ ...item, status: "Ended" });
			} else if (activeStatuses.includes(norm)) {
				activeByStatus[norm].push(item);
			} else {
				activeByStatus["Pending Searchmind"].push(item);
			}
		});

		return { activeByStatus, endedItems };
	}, [lineItemsWithContext]);

	function onDragEnd(result) {
		const { source, destination, draggableId } = result;
		if (!destination || source.droppableId === destination.droppableId) return;
		if (destination.droppableId === "Ended") return;
		if (onStatusChange) onStatusChange(draggableId, destination.droppableId);
	}

	const activeCols = LINE_ITEM_STATUSES.filter((s) => s !== "Ended");

	return (
		<div className="apex-cp-panel-card">
			<h3 className="apex-cp-panel-card__title">Campaign types — workflow</h3>
			<p className="apex-cp-panel-card__subtitle">
				Drag cards between columns to change status. Click a card to edit.
			</p>
			<DragDropContext onDragEnd={onDragEnd}>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
					{activeCols.map((status) => {
						const colStyle =
							LINE_ITEM_STATUS_STYLES[status] || defaultLineItemStatusStyle();
						return (
							<Droppable droppableId={status} key={status}>
								{(provided) => (
									<div
										ref={provided.innerRef}
										{...provided.droppableProps}
										className="apex-cp-kanban-col"
										style={{ borderColor: colStyle.border }}
									>
										<div
											className="apex-cp-kanban-col__title"
											style={{ color: colStyle.border }}
										>
											{status}
										</div>
										{activeByStatus[status].length === 0 && (
											<div className="apex-cp-kanban-empty">None</div>
										)}
										{activeByStatus[status].map((item, idx) => {
											const pal =
												LINE_ITEM_STATUS_STYLES[status] ||
												defaultLineItemStatusStyle();
											const lineEnded = isLineItemEnded(item);
											return (
												<Draggable draggableId={item.id} index={idx} key={item.id}>
													{(provided, snapshot) => {
														const {
															style: dragStyle,
															...dragProps
														} = provided.draggableProps;
														return (
															<div
																ref={provided.innerRef}
																{...dragProps}
																{...provided.dragHandleProps}
																role="button"
																tabIndex={0}
																onClick={() => onOpenLineItem?.(item)}
																onKeyDown={(e) => {
																	if (e.key === "Enter" || e.key === " ")
																		onOpenLineItem?.(item);
																}}
																className={`apex-cp-kanban-card ${
																	lineEnded ? "apex-cp-kanban-card--ended" : ""
																} ${snapshot.isDragging ? "is-dragging" : ""}`}
																style={{
																	...dragStyle,
																	...(lineEnded
																		? {}
																		: { borderLeftColor: pal.border }),
																}}
															>
																<div
																	style={{
																		backgroundColor:
																			SERVICE_COLORS[item._serviceName] ||
																			"var(--perf-accent)",
																	}}
																	className="apex-cp-kanban-service"
																>
																	<span>{item._serviceName || "—"}</span>
																</div>
																<div className="font-bold text-sm text-[var(--color-ink)]">
																	{item.name}
																</div>
																{item._parentName && (
																	<div className="text-xs font-medium text-[var(--color-ink-2)] truncate">
																		{item._parentName}
																	</div>
																)}
																<div className="text-xs text-[var(--color-muted)]">
																	{[
																		item.media,
																		Array.isArray(item.formats) &&
																		item.formats.length
																			? item.formats.join(", ")
																			: item.format,
																	]
																		.filter(Boolean)
																		.join(" · ")}
																	<div className="mt-0.5">
																		{item.alwaysOn
																			? item.startDate
																				? `${formatIsoDate(item.startDate)} · Always on`
																				: "Always on"
																			: `${formatIsoDate(item.startDate)} – ${formatIsoDate(item.endDate)}`}
																	</div>
																	{item.budget != null &&
																		!Number.isNaN(Number(item.budget)) &&
																		Number(item.budget) > 0 && (
																			<span className="block">
																				Budget:{" "}
																				{Number(item.budget).toLocaleString(
																					"da-DK"
																				)}
																			</span>
																		)}
																</div>
															</div>
														);
													}}
												</Draggable>
											);
										})}
										{provided.placeholder}
									</div>
								)}
							</Droppable>
						);
					})}

					<div className="apex-cp-kanban-ended-col">
						<div className="apex-cp-kanban-col__title">Ended</div>
						{endedItems.length === 0 ? (
							<div className="apex-cp-kanban-empty">None</div>
						) : (
							endedItems.map((item) => (
								<div
									key={item.id}
									role="button"
									tabIndex={0}
									onClick={() => onOpenLineItem?.(item)}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ")
											onOpenLineItem?.(item);
									}}
									className="apex-cp-kanban-card apex-cp-kanban-card--ended cursor-pointer"
								>
									<div
										style={{
											backgroundColor:
												SERVICE_COLORS[item._serviceName] ||
												"var(--perf-accent)",
										}}
										className="apex-cp-kanban-service opacity-90"
									>
										<span>{item._serviceName}</span>
									</div>
									<div className="font-semibold text-sm text-[var(--color-ink)] truncate">
										{item.name}
									</div>
									{item._parentName && (
										<div className="text-xs text-[var(--color-ink-2)] truncate font-medium">
											{item._parentName}
										</div>
									)}
									<div className="text-xs text-[var(--color-muted)]">
										{item.alwaysOn
											? item.startDate
												? `${formatIsoDate(item.startDate)} · Always on`
												: "Always on"
											: `${formatIsoDate(item.startDate)} – ${formatIsoDate(item.endDate)}`}
									</div>
								</div>
							))
						)}
					</div>
				</div>
			</DragDropContext>

			{filterDateRange?.startDate && filterDateRange?.endDate && (
				<div className="apex-cp-footnote">
					<span className="font-medium text-[var(--color-ink-2)]">
						Overview period:{" "}
					</span>
					{filterDateRange.startDate} → {filterDateRange.endDate}
					<span className="text-[var(--color-muted)]">
						{" "}
						(filters above; ended campaign types still show with their campaign)
					</span>
				</div>
			)}
		</div>
	);
}
