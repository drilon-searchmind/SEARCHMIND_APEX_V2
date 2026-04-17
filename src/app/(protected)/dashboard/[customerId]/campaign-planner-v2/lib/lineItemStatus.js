/** Aligns with calendar / kanban campaign-type status colors */

export const LINE_ITEM_STATUS_STYLES = {
	"Pending Searchmind": { bg: "#fde68a", border: "#d97706" },
	"Pending Customer Approval": { bg: "#fed7aa", border: "#ea580c" },
	Approved: { bg: "#bfdbfe", border: "#2563eb" },
	Live: { bg: "#bbf7d0", border: "#16a34a" },
	Ended: { bg: "#e5e7eb", border: "#64748b" },
};

export function defaultLineItemStatusStyle() {
	return { bg: "#e2e8f0", border: "#64748b" };
}

/** Normalize legacy "Pending" from stored data */
export function normalizeLineItemStatus(status) {
	if (status === "Pending") return "Pending Searchmind";
	return status || "Pending Searchmind";
}

export function isLineItemEndedVisual(item) {
	if (!item) return false;
	if (item.status === "Ended") return true;
	if (item.alwaysOn) return false;
	if (!item.endDate) return false;
	const end = new Date(item.endDate);
	end.setHours(0, 0, 0, 0);
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	return end < today;
}
