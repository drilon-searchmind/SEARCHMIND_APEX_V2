"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Calendar, momentLocalizer, Views } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { FiCalendar } from "react-icons/fi";
import "../styles/planner-v2-calendar.css";
import {
  LINE_ITEM_STATUS_STYLES,
  defaultLineItemStatusStyle,
  normalizeLineItemStatus,
} from "../lib/lineItemStatus";

const localizer = momentLocalizer(moment);

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
  embedded = false,
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
          backgroundColor: "var(--color-ink)",
          color: "#ffffff",
          border: "1px solid var(--color-ink)",
          borderLeft: "4px solid var(--apex-lime)",
          fontWeight: 600,
        },
      };
    }
    const st =
      LINE_ITEM_STATUS_STYLES[
        normalizeLineItemStatus(event.lineItem?.status)
      ] || defaultLineItemStatusStyle();
    return {
      style: {
        backgroundColor: st.bg,
        color: "var(--color-ink)",
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
      className={`apex-cp-schedule-panel ${embedded ? "mt-0" : "mt-10"}`}
      aria-labelledby="planner-v2-calendar-heading"
    >
      <div className="apex-cp-schedule-head">
        <div className="flex gap-3">
          <div className="apex-cp-schedule-head__icon" aria-hidden>
            <FiCalendar className="w-5 h-5" />
          </div>
          <div>
            <h2
              id="planner-v2-calendar-heading"
              className="apex-cp-schedule-head__title"
            >
              Calendar
            </h2>
            <p className="apex-cp-schedule-head__subtitle">
              Campaign windows and campaign-type schedules from your current
              filters. Click an event to edit.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-[var(--color-muted)] sm:justify-end">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--perf-raised)] border border-[var(--color-rule)] px-3 py-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm border-l-2 border-[var(--color-accent)] bg-[var(--perf-accent)]"
              aria-hidden
            />
            Campaign
          </span>
        </div>
      </div>

      <div className="apex-cp-schedule-surface">
        {events.length === 0 ? (
          <div className="apex-cp-schedule-empty">
            <FiCalendar className="w-12 h-12 mb-3 opacity-40" />
            <p className="font-medium text-[var(--color-ink-2)]">Nothing to show yet</p>
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
