export function yyyymmddToIso(d) {
    if (!d) return d;
    const s = String(d);
    if (s.includes("-")) return s.slice(0, 10);
    if (s.length >= 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    return s;
}

export function mapReportToRows(json) {
    if (!json?.rows?.length) return [];
    const dimHeaders = json.dimensionHeaders?.map((h) => h.name) || [];
    const metHeaders = json.metricHeaders?.map((h) => h.name) || [];
    return json.rows.map((row) => {
        const dimObj = {};
        row.dimensionValues?.forEach((v, i) => {
            dimObj[dimHeaders[i]] = v.value;
        });
        const metObj = {};
        row.metricValues?.forEach((v, i) => {
            const key = metHeaders[i];
            const num = Number(v.value);
            metObj[key] = Number.isNaN(num) ? v.value : num;
        });
        return { ...dimObj, ...metObj };
    });
}

export function sumGa4Metric(rows, key) {
    return (rows || []).reduce((sum, row) => sum + (Number(row?.[key]) || 0), 0);
}

export function averageGa4Metric(rows, key) {
    const valid = (rows || []).filter((row) => row?.[key] != null);
    if (!valid.length) return 0;
    return valid.reduce((sum, row) => sum + (Number(row[key]) || 0), 0) / valid.length;
}
