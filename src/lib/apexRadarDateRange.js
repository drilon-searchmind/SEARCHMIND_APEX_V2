/**
 * Apex Radar uses a fixed rolling window (no date picker).
 * @param {Date} [referenceDate]
 * @returns {{ startDate: string, endDate: string }}
 */
export function getApexRadarLast30DaysRange(referenceDate = new Date()) {
    const end = new Date(referenceDate);
    end.setDate(end.getDate() - 1);

    const start = new Date(end);
    start.setDate(start.getDate() - 29);

    const format = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    };

    return { startDate: format(start), endDate: format(end) };
}
