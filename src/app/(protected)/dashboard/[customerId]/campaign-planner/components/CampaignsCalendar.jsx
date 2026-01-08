import React from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";

const localizer = momentLocalizer(moment);

export default function CampaignsCalendar({ campaigns = [] }) {
    // Map campaigns to calendar events
    const events = campaigns.map((c) => ({
        id: c.id,
        title: c.campaignName,
        start: c.startDate ? new Date(c.startDate) : new Date(),
        end: c.endDate ? new Date(c.endDate) : new Date(),
        status: c.status,
    }));

    return (
        <div className="w-full bg-white border border-gray-200 rounded-xl p-4">
            <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                style={{ height: 500 }}
                views={["month", "week", "day"]}
                eventPropGetter={(event) => {
                    // Color by status
                    let bg = "#e5e7eb";
                    if (event.status === "Pending") bg = "#fde68a";
                    if (event.status === "Approved") bg = "#bfdbfe";
                    if (event.status === "Live") bg = "#bbf7d0";
                    if (event.status === "Pending Customer Approval") bg = "#fed7aa";
                    return { style: { backgroundColor: bg, borderRadius: "8px", color: "#222" } };
                }}
                titleAccessor="title"
            />
        </div>
    );
}
