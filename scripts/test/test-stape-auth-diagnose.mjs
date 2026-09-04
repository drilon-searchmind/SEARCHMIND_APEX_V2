import dotenv from "dotenv";

dotenv.config();

const key = String(process.env.STAPE_API_KEY || "");
const trimmed = key.trim();

console.log("STAPE_API_KEY set:", Boolean(trimmed));
console.log("STAPE_API_KEY length:", trimmed.length);
console.log("has surrounding quotes:", /^["']|["']$/.test(trimmed));
console.log("has outer whitespace:", key !== trimmed);
console.log("STAPE_API_BASE:", process.env.STAPE_API_BASE || "(default global)");

const headers = [
    ["X-AUTH-TOKEN", trimmed],
    ["X-Auth-Token", trimmed],
    ["Authorization", `Bearer ${trimmed}`],
    ["x-api-key", trimmed],
];

for (const [header, value] of headers) {
    const res = await fetch("https://api.app.stape.io/api/v2/partner-tracking-checker/limit", {
        headers: { accept: "application/json", [header]: value },
    });
    const text = await res.text();
    console.log(`${header}: ${res.status} ${text.slice(0, 150)}`);
}
