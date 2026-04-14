"use client";

import React, { useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { LINE_ITEM_STATUSES, SERVICE_COLORS } from "../constants";

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

export default function LineItemsKanban({
  lineItemsWithContext = [],
  onStatusChange,
  onOpenLineItem,
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
      if (syntheticEnded || item.status === "Ended") {
        endedItems.push({ ...item, status: "Ended" });
      } else if (activeStatuses.includes(item.status)) {
        activeByStatus[item.status].push(item);
      } else {
        activeByStatus["Pending"].push(item);
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
          {activeCols.map((status) => (
            <Droppable droppableId={status} key={status}>
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="bg-white border border-gray-200 rounded-lg p-4 min-h-[200px] flex flex-col gap-1"
                >
                  <div className="mb-2">
                    <div className="font-medium text-gray-900">{status}</div>
                    {status === "Pending" && (
                      <div className="text-xs text-gray-500 mt-0.5 font-normal">
                        Pending Searchmind
                      </div>
                    )}
                  </div>
                  {activeByStatus[status].length === 0 && (
                    <div className="text-gray-400 py-8 text-center text-sm">
                      None
                    </div>
                  )}
                  {activeByStatus[status].map((item, idx) => (
                    <Draggable draggableId={item.id} index={idx} key={item.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          role="button"
                          tabIndex={0}
                          onClick={() => onOpenLineItem?.(item)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ")
                              onOpenLineItem?.(item);
                          }}
                          className={`cursor-pointer bg-gray-50 border border-gray-200 rounded-lg p-3 mb-2 flex flex-col gap-1 shadow-xs transition-shadow ${
                            snapshot.isDragging ? "shadow-lg" : ""
                          }`}
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
                          <div className="text-xs text-gray-600">
                            {item._parentName && (
                              <span className="block truncate">
                                {item._parentName}
                              </span>
                            )}
                            {[
                              item.media,
                              Array.isArray(item.formats) && item.formats.length
                                ? item.formats.join(", ")
                                : item.format,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                            {item.budget != null &&
                              !Number.isNaN(Number(item.budget)) &&
                              Number(item.budget) > 0 && (
                                <span className="block text-gray-500">
                                  Budget: {Number(item.budget).toLocaleString("da-DK")}
                                </span>
                              )}
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          ))}

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 min-h-[200px] flex flex-col gap-1">
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
                  className="border border-gray-200 rounded-lg p-2 mb-1 flex flex-col gap-1 shadow-xs cursor-pointer hover:bg-gray-100 bg-white opacity-90"
                >
                  <div
                    style={{
                      backgroundColor:
                        SERVICE_COLORS[item._serviceName] || "#e5e7eb",
                    }}
                    className="rounded-lg px-2 py-1 opacity-80"
                  >
                    <span className="text-xs font-semibold text-gray-700">
                      {item._serviceName}
                    </span>
                  </div>
                  <div className="font-semibold text-sm text-gray-900 truncate">
                    {item.name}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DragDropContext>
    </div>
  );
}
