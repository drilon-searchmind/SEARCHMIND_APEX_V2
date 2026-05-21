/**
 * Client-safe date helpers for Run Audit modal.
 * @param {string} startDate YYYY-MM-DD
 */
export function minusOneYearDate(startDate) {
    if (!startDate) return "";
    const [y, m, d] = String(startDate).split("-");
    const yi = parseInt(y, 10);
    if (!Number.isFinite(yi)) return "";
    return `${yi - 1}-${m}-${d}`;
}
