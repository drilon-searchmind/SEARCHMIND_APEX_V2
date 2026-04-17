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
		<div className="w-full bg-white border border-gray-200 rounded-xl p-6">
			<h3 className="text-xl font-semibold text-gray-900 mb-4">
				Campaign types — workflow
			</h3>
			<p className="text-sm text-gray-500 mb-6">
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
										className="rounded-lg p-4 min-h-[200px] flex flex-col gap-1 border bg-white"
										style={{ borderColor: colStyle.border }}
									>
										<div className="mb-2">
											<div
												className="font-medium text-gray-900"
												style={{ color: colStyle.border }}
											>
												{status}
											</div>
										</div>
										{activeByStatus[status].length === 0 && (
											<div className="text-gray-400 py-8 text-center text-sm">
												None
											</div>
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
															className={`cursor-grab active:cursor-grabbing rounded-lg p-3 mb-2 flex flex-col gap-1 border border-l-2 transition-shadow ${
																lineEnded
																	? "border-[#9a3412] border-l-[#c2410c] bg-[#fff7ed]/70"
																	: "border-gray-200 bg-gray-50"
															} ${snapshot.isDragging ? "shadow-lg ring-1 ring-[var(--color-primary-searchmind)]/40" : ""}`}
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
																		SERVICE_COLORS[item._serviceName] || "#e5e7eb",
																}}
																className="rounded-lg px-2 py-1"
															>
																<span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
																	{item._serviceName || "—"}
																</span>
															</div>
															<div className="font-bold text-sm text-gray-900">
																{item.name}
															</div>
															{item._parentName && (
																<div className="text-xs font-medium text-gray-800 truncate">
																	{item._parentName}
																</div>
															)}
															<div className="text-xs text-gray-600">
																{[
																	item.media,
																	Array.isArray(item.formats) && item.formats.length
																		? item.formats.join(", ")
																		: item.format,
																]
																	.filter(Boolean)
																	.join(" · ")}
																<div className="mt-0.5 text-gray-500">
																	{item.alwaysOn
																		? item.startDate
																			? `${formatIsoDate(item.startDate)} · Always on`
																			: "Always on"
																		: `${formatIsoDate(item.startDate)} – ${formatIsoDate(item.endDate)}`}
																</div>
																{item.budget != null &&
																	!Number.isNaN(Number(item.budget)) &&
																	Number(item.budget) > 0 && (
																		<span className="block text-gray-500">
																			Budget:{" "}
																			{Number(item.budget).toLocaleString("da-DK")}
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

					<div className="bg-gray-50 border border-gray-300 rounded-lg p-4 min-h-[200px] flex flex-col gap-1">
						<div className="font-medium text-gray-900 mb-2">Ended</div>
						{endedItems.length === 0 ? (
							<div className="text-gray-400 py-8 text-center text-sm">None</div>
						) : (
							endedItems.map((item) => (
								<div
									key={item.id}
									role="button"
									tabIndex={0}
									onClick={() => onOpenLineItem?.(item)}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") onOpenLineItem?.(item);
									}}
									className="border border-[#9a3412]/40 border-l-2 border-l-[#c2410c] rounded-lg p-2 mb-1 flex flex-col gap-1 bg-[#fff7ed]/80 cursor-pointer hover:bg-[#fff7ed]"
								>
									<div
										style={{
											backgroundColor:
												SERVICE_COLORS[item._serviceName] || "#e5e7eb",
										}}
										className="rounded-lg px-2 py-1 opacity-90"
									>
										<span className="text-xs font-semibold text-gray-700">
											{item._serviceName}
										</span>
									</div>
									<div className="font-semibold text-sm text-gray-900 truncate">
										{item.name}
									</div>
									{item._parentName && (
										<div className="text-xs text-gray-700 truncate font-medium">
											{item._parentName}
										</div>
									)}
									<div className="text-xs text-gray-600">
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
				<div className="mt-6 pt-4 border-t border-gray-200 text-sm text-gray-600">
					<span className="font-medium text-gray-800">Overview period: </span>
					{filterDateRange.startDate} → {filterDateRange.endDate}
					<span className="text-gray-500">
						{" "}
						(filters above; ended campaign types still show with their campaign)
					</span>
				</div>
			)}
		</div>
	);
}
