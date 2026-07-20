/** Aligns with calendar / kanban campaign-type status colors */

export const LINE_ITEM_STATUS_STYLES = {
	"Pending Searchmind": { bg: "#f4f3f1", border: "#a3a3a3" },
	"Pending Customer Approval": { bg: "#fafaf9", border: "#c6ed62" },
	Approved: { bg: "#eeede9", border: "#525252" },
	Live: { bg: "#c6ed62", border: "#131313" },
	Ended: { bg: "#eeede9", border: "#6b6b6b" },
};

export function defaultLineItemStatusStyle() {
	return { bg: "#f4f3f1", border: "#d8d5d0" };
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
