/**
 * Fetch active ClickUp customers from list 210313781 and export CSV for compareClickupCustomers.js
 *
 * Prerequisites: `.env` with CLICKUP_API_TOKEN
 *
 * Usage:
 *   node scripts/clickup/fetchClickupCustomers.js
 *   node scripts/clickup/fetchClickupCustomers.js --output=scripts/clickup/clickup_customers.csv
 *   node scripts/clickup/fetchClickupCustomers.js --all-statuses   # skip "Aktiv" filter (debug)
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Same list as src/lib/clickupCustomerTeamFetch.js */
const CLICKUP_TEAM_LIST_ID = "210313781";

/** Custom field: customer status — "Aktiv" = active customers */
export const CLICKUP_CUSTOMER_STATUS_FIELD_ID = "d67f1403-0fcd-45b8-a455-ac2740ab2265";
export const CLICKUP_ACTIVE_STATUS_LABEL = "Aktiv";

const DEFAULT_OUTPUT = path.join(__dirname, "clickup_customers.csv");

function parseArgs() {
    const opts = {
        output: DEFAULT_OUTPUT,
        allStatuses: false,
    };
    for (const arg of process.argv.slice(2)) {
        if (arg === "--all-statuses") opts.allStatuses = true;
        else if (arg.startsWith("--output=")) opts.output = arg.slice("--output=".length);
    }
    return opts;
}

function getClickupToken() {
    const token = process.env.CLICKUP_API_TOKEN?.trim();
    if (!token) {
        throw new Error("CLICKUP_API_TOKEN is missing from .env");
    }
    return token;
}

/**
 * Resolve dropdown/label custom field value to human-readable label.
 */
export function resolveClickupCustomFieldLabel(field) {
    if (!field || field.value == null || field.value === "") return null;

    const { value } = field;
    const options = field.type_config?.options;

    if (Array.isArray(options) && options.length > 0) {
        if (typeof value === "number") {
            const byIndex = options.find((o) => o.orderindex === value);
            if (byIndex) return byIndex.name || byIndex.label || null;
        }
        if (typeof value === "string") {
            const byId = options.find((o) => o.id === value);
            if (byId) return byId.name || byId.label || null;
        }
        if (Array.isArray(value)) {
            const labels = value
                .map((v) => {
                    const opt = options.find((o) => o.id === v || o.orderindex === v);
                    return opt?.name || opt?.label || null;
                })
                .filter(Boolean);
            if (labels.length) return labels.join(", ");
        }
    }

    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    return null;
}

export function getCustomerStatusLabel(task) {
    const field = task.custom_fields?.find((f) => f.id === CLICKUP_CUSTOMER_STATUS_FIELD_ID);
    return resolveClickupCustomFieldLabel(field);
}

export function isActiveClickupCustomer(task) {
    const label = getCustomerStatusLabel(task);
    return label?.trim().toLowerCase() === CLICKUP_ACTIVE_STATUS_LABEL.toLowerCase();
}

async function fetchClickupListTasks(listId, token) {
    const allTasks = [];
    let page = 0;

    while (true) {
        const url = new URL(`https://api.clickup.com/api/v2/list/${listId}/task`);
        url.searchParams.set("page", String(page));
        url.searchParams.set("subtasks", "false");
        url.searchParams.set("include_closed", "true");

        const res = await fetch(url.toString(), {
            method: "GET",
            headers: {
                accept: "application/json",
                Authorization: token,
            },
        });

        if (!res.ok) {
            const body = await res.text();
            throw new Error(`ClickUp API error ${res.status} on page ${page}: ${body}`);
        }

        const data = await res.json();
        const tasks = data.tasks || [];
        allTasks.push(...tasks);

        process.stdout.write(`\rFetched page ${page + 1} (${allTasks.length} tasks so far)...`);

        if (data.last_page) break;
        page += 1;
        await new Promise((r) => setTimeout(r, 200));
    }

    process.stdout.write("\n");
    return allTasks;
}

function escapeCsvValue(value) {
    const s = String(value ?? "");
    if (/[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

function tasksToCsvRows(tasks) {
    return tasks
        .map((task) => ({
            client_id: String(task.id || "").trim(),
            client_name: String(task.name || "").trim(),
        }))
        .filter((row) => row.client_id && row.client_name)
        .sort((a, b) => a.client_name.localeCompare(b.client_name, "da"));
}

async function main() {
    const opts = parseArgs();
    const token = getClickupToken();

    console.log(`Fetching tasks from ClickUp list ${CLICKUP_TEAM_LIST_ID}...`);
    const allTasks = await fetchClickupListTasks(CLICKUP_TEAM_LIST_ID, token);
    console.log(`Total tasks in list: ${allTasks.length}`);

    const filtered = opts.allStatuses
        ? allTasks
        : allTasks.filter(isActiveClickupCustomer);

    if (!opts.allStatuses) {
        const statusCounts = {};
        for (const task of allTasks) {
            const label = getCustomerStatusLabel(task) || "(empty)";
            statusCounts[label] = (statusCounts[label] || 0) + 1;
        }
        console.log("\nStatus breakdown (all tasks):");
        for (const [label, count] of Object.entries(statusCounts).sort((a, b) => b[1] - a[1])) {
            console.log(`  ${label}: ${count}`);
        }
        console.log(`\nActive ("${CLICKUP_ACTIVE_STATUS_LABEL}") customers: ${filtered.length}`);
    } else {
        console.log(`Including all statuses: ${filtered.length} tasks`);
    }

    const rows = tasksToCsvRows(filtered);
    const csv = ["client_id,client_name", ...rows.map((r) => `${r.client_id},${escapeCsvValue(r.client_name)}`)].join(
        "\n"
    );

    const outputPath = path.resolve(opts.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, csv, "utf-8");

    console.log(`\n✅ Wrote ${rows.length} customers to: ${outputPath}`);
    console.log("\nNext step — compare with MongoDB:");
    console.log("  node scripts/clickup/compareClickupCustomers.js");
}

main().catch((err) => {
    console.error("Error:", err.message || err);
    process.exit(1);
});
