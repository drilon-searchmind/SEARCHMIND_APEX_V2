import fs from "fs";
import path from "path";
import { readCsvRecords } from "../../../../../scripts/clickup/csvUtils.js";

const ENRICHED_CSV = path.join(process.cwd(), "scripts", "clickup", "missing_customers_enriched.csv");
const BASIC_CSV = path.join(process.cwd(), "scripts", "clickup", "missing_customers.csv");

export async function GET() {
    try {
        const csvPath = fs.existsSync(ENRICHED_CSV) ? ENRICHED_CSV : BASIC_CSV;

        if (!fs.existsSync(csvPath)) {
            return Response.json({ error: "Missing customers CSV file not found" }, { status: 404 });
        }

        const { records } = readCsvRecords(csvPath, fs);
        return Response.json(records);
    } catch (error) {
        console.error("Error reading missing customers CSV:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
