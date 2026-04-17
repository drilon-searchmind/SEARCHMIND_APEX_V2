"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Calendar, momentLocalizer, Views } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { FiCalendar } from "react-icons/fi";
import "../styles/planner-v2-calendar.css";

const localizer = momentLocalizer(moment);

const LINE_STATUS_STYLES = {
  Pending: { bg: "#fde68a", border: "#d97706" },
  "Pending Customer Approval": { bg: "#fed7aa", border: "#ea580c" },
  Approved: { bg: "#bfdbfe", border: "#2563eb" },
  Live: { bg: "#bbf7d0", border: "#16a34a" },
  Ended: { bg: "#e5e7eb", border: "#64748b" },
};

function defaultStatusStyle() {
  return { bg: "#e2e8f0", border: "#64748b" };
}

/**
 * All-day range for react-big-calendar (end is exclusive).
 */
function parentAllDayRange(parent) {
  const startM = parent.startDate
    ? moment(parent.startDate).startOf("day")
    : parent.createdAt
      ? moment(parent.createdAt).startOf("day")
      : null;
  if (!startM?.isValid()) return null;

  let endExclusive;
  if (parent.alwaysOn) {
    endExclusive = startM.clone().add(12, "months");
  } else if (parent.endDate) {
    endExclusive = moment(parent.endDate).startOf("day").add(1, "day");
  } else {
    endExclusive = startM.clone().add(1, "day");
  }

  return { start: startM.toDate(), end: endExclusive.toDate() };
}

function lineItemAllDayRange(li) {
  if (!li.startDate) return null;
  const startM = moment(li.startDate).startOf("day");
  if (!startM.isValid()) return null;

  let endExclusive;
  if (li.alwaysOn) {
    endExclusive = startM.clone().add(6, "months");
  } else if (li.endDate) {
    endExclusive = moment(li.endDate).startOf("day").add(1, "day");
  } else {
    endExclusive = startM.clone().add(1, "day");
  }

  return { start: startM.toDate(), end: endExclusive.toDate() };
}

export default function PlannerV2CalendarSection({
  parents = [],
  lineItemsWithContext = [],
  onSelectParent,
  onSelectLineItem,
}) {
  const [calDate, setCalDate] = useState(() => new Date());
  const [calView, setCalView] = useState(Views.MONTH);

  const events = useMemo(() => {
    const list = [];

    parents.forEach((p) => {
      const range = parentAllDayRange(p);
      if (!range) return;
      list.push({
        id: `parent-${p.id}`,
        title: p.campaignName || "Campaign",
        start: range.start,
        end: range.end,
        allDay: true,
        kind: "parent",
        parent: p,
      });
    });

    lineItemsWithContext.forEach((li) => {
      const range = lineItemAllDayRange(li);
      if (!range) return;
      const parentPart = li._parentName ? `${li._parentName} · ` : "";
      list.push({
        id: `line-${li.id}`,
        title: `${parentPart}${li.name}`,
        start: range.start,
        end: range.end,
        allDay: true,
        kind: "lineItem",
        lineItem: li,
      });
    });

    return list;
  }, [parents, lineItemsWithContext]);

  const handleSelectEvent = useCallback(
    (event) => {
      if (event.kind === "parent" && event.parent && onSelectParent) {
        onSelectParent(event.parent);
      } else if (event.kind === "lineItem" && event.lineItem && onSelectLineItem) {
        onSelectLineItem(event.lineItem);
      }
    },
    [onSelectParent, onSelectLineItem]
  );

  const eventPropGetter = useCallback((event) => {
    if (event.kind === "parent") {
      return {
        style: {
          backgroundColor: "rgba(59, 130, 246, 0.22)",
          color: "#0f172a",
          border: "1px solid rgba(37, 99, 235, 0.45)",
          borderLeft: "4px solid var(--color-primary-searchmind)",
          fontWeight: 600,
        },
      };
    }
    const st = LINE_STATUS_STYLES[event.lineItem?.status] || defaultStatusStyle();
    return {
      style: {
        backgroundColor: st.bg,
        color: "#1e293b",
        border: `1px solid ${st.border}`,
        fontWeight: 500,
      },
    };
  }, []);

  const tooltipAccessor = useCallback((event) => {
    if (event.kind === "parent") {
      const p = event.parent;
      const span = p.alwaysOn
        ? "Always on"
        : `${moment(event.start).format("D MMM YYYY")} → ${moment(event.end).subtract(1, "day").format("D MMM YYYY")}`;
      return `${event.title} (Campaign) · ${span}`;
    }
    const li = event.lineItem;
    const span = li.alwaysOn
      ? "Always on"
      : `${moment(event.start).format("D MMM YYYY")} → ${moment(event.end).subtract(1, "day").format("D MMM YYYY")}`;
    return `${event.title} · ${li.status} · ${span}`;
  }, []);

  return (
    <section
      className="mt-10 rounded-xl border border-gray-200 bg-gray-100 p-4 md:p-6"
      aria-labelledby="planner-v2-calendar-heading"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
        <div className="flex gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white border border-gray-200 text-[var(--color-primary-searchmind)]"
            aria-hidden
          >
            <FiCalendar className="w-5 h-5" />
          </div>
          <div>
            <h2
              id="planner-v2-calendar-heading"
              className="text-lg font-semibold text-gray-900 tracking-tight"
            >
              Calendar
            </h2>
            <p className="text-sm text-gray-600 mt-0.5 max-w-xl">
              Campaign windows and campaign-type schedules from your current
              filters. Click an event to edit.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-gray-600 sm:justify-end">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-gray-200 px-3 py-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm border-l-2 border-[var(--color-primary-searchmind)] bg-blue-100"
              aria-hidden
            />
            Campaign
          </span>
        </div>
      </div>

      <div className="rounded-xl bg-white border border-gray-200 p-3 md:p-4">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4 text-gray-500">
            <FiCalendar className="w-12 h-12 text-gray-300 mb-3" />
            <p className="font-medium text-gray-700">Nothing to show yet</p>
            <p className="text-sm mt-1 max-w-sm">
              Add start dates to campaigns or campaign types, or widen your
              filters above.
            </p>
          </div>
        ) : (
          <div className="cp-rbc">
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ minHeight: 560 }}
              views={[Views.MONTH, Views.WEEK, Views.DAY]}
              view={calView}
              onView={setCalView}
              date={calDate}
              onNavigate={(newDate) => setCalDate(newDate)}
              popup
              onSelectEvent={handleSelectEvent}
              eventPropGetter={eventPropGetter}
              titleAccessor="title"
              tooltipAccessor={tooltipAccessor}
            />
          </div>
        )}
      </div>
    </section>
  );
}
