/**
 * Minimal CSV read/write for ClickUp scripts (handles quoted fields).
 */

export function parseCsv(content) {
    const rows = [];
    const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    for (const line of lines) {
        if (!line.trim()) continue;
        rows.push(parseCsvLine(line));
    }
    return rows;
}

function parseCsvLine(line) {
    const fields = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                current += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ",") {
            fields.push(current);
            current = "";
        } else {
            current += ch;
        }
    }
    fields.push(current);
    return fields;
}

export function escapeCsvValue(value) {
    const s = value == null ? "" : String(value);
    if (/[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

export function rowsToCsv(headers, records) {
    const lines = [headers.join(",")];
    for (const record of records) {
        lines.push(headers.map((h) => escapeCsvValue(record[h])).join(","));
    }
    return lines.join("\n");
}

export function readCsvRecords(filePath, fs) {
    const content = fs.readFileSync(filePath, "utf-8");
    const rows = parseCsv(content);
    if (!rows.length) return { headers: [], records: [] };

    const headers = rows[0].map((h) => h.trim());
    const records = rows.slice(1).map((cells) => {
        const record = {};
        headers.forEach((header, i) => {
            record[header] = (cells[i] ?? "").trim();
        });
        return record;
    });
    return { headers, records };
}
