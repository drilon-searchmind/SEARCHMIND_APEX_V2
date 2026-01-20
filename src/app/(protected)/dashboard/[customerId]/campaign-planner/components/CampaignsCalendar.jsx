import React from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";

const localizer = momentLocalizer(moment);

export default function CampaignsCalendar({ campaigns = [], onViewDetails }) {
    // Map campaigns to calendar events
    const events = campaigns.map((c) => ({
        id: c.id || c._id,
        title: c.campaignName,
        start: c.startDate ? new Date(c.startDate) : new Date(),
        end: c.endDate ? new Date(c.endDate) : new Date(),
        status: c.status,
        campaign: c, // Store full campaign data for modal
    }));

    const handleSelectEvent = (event) => {
        if (onViewDetails && event.campaign) {
            onViewDetails(event.campaign);
        }
    };

    const handleSelectSlot = (slotInfo) => {
        // Get all events for the selected date
        const eventsOnDate = events.filter(event => {
            const eventDate = new Date(event.start).toDateString();
            const selectedDate = new Date(slotInfo.start).toDateString();
            return eventDate === selectedDate;
        });

        if (eventsOnDate.length > 1) {
            // If multiple events on the same date, show a simple alert for now
            // In a more advanced implementation, you could show a modal with all events
            const eventTitles = eventsOnDate.map(e => e.title).join(', ');
            alert(`Multiple campaigns on this date:\n${eventTitles}\n\nClick on individual events to view details.`);
        }
    };

    return (
        <div className="w-full bg-white border border-gray-200 rounded-xl p-4">
            <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                style={{ height: 500 }}
                views={["month", "week", "day"]}
                onSelectEvent={handleSelectEvent}
                onSelectSlot={handleSelectSlot}
                selectable={true}
                popup={true}
                eventPropGetter={(event) => {
                    // Use brand colors from CSS variables
                    let bg = "var(--color-secondary-searchmind)"; // Default
                    let textColor = "#1E2B2B"; // Primary color

                    if (event.status === "Pending") bg = "#fde68a"; // Keep yellow for pending
                    if (event.status === "Approved") bg = "#bfdbfe"; // Keep blue for approved
                    if (event.status === "Live") bg = "#bbf7d0"; // Keep green for live
                    if (event.status === "Pending Customer Approval") bg = "#fed7aa"; // Keep orange for pending approval
                    if (event.status === "Ended") bg = "#e5e7eb"; // Gray for ended

                    return {
                        style: {
                            backgroundColor: bg,
                            borderRadius: "6px",
                            color: textColor,
                            border: "1px solid rgba(30, 43, 43, 0.1)",
                            fontSize: "12px",
                            fontWeight: "500"
                        }
                    };
                }}
                titleAccessor="title"
                tooltipAccessor={(event) => `${event.title} (${event.status})`}
            />
        </div>
    );
}
