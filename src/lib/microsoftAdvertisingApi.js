/**
 * Microsoft Advertising (Bing Ads) — OAuth + Reporting API (SOAP v13).
 *
 * ## Why SOAP/XML here (unlike Pinterest `pinterestApi.js`)?
 *
 * - **Token refresh** uses normal `fetch` + `application/x-www-form-urlencoded` — same style as other integrations.
 * - **Performance reports** are exposed only through Microsoft’s **Reporting Service (SOAP/WCF)** for v13.
 *   There is no supported JSON REST URL for `SubmitGenerateReport` / `PollGenerateReport` the way Pinterest exposes `/v5` REST.
 *   So the XML envelopes below are required by Microsoft’s contract, not an arbitrary style choice.
 *
 * ## Environment variables (server-only, `.env` / deployment secrets)
 *
 * | Variable | Required | Description |
 * |----------|----------|-------------|
 * | `MICROSOFT_ADVERTISING_DEVELOPER_TOKEN` | Yes | From Microsoft Advertising → Tools → API → Developer token (apply for production). |
 * | `MICROSOFT_ADVERTISING_CLIENT_ID` | Yes | Azure App Registration → Application (client) ID. |
 * | `MICROSOFT_ADVERTISING_CLIENT_SECRET` | Yes | App registration → Certificates & secrets → Client secret value. |
 * | `MICROSOFT_ADVERTISING_REFRESH_TOKEN` | Yes | Long-lived refresh token from OAuth (use `scripts/get-microsoft-ads-refresh-token.js`). |
 * | `MICROSOFT_ADVERTISING_TENANT_ID` | **Yes for single-tenant apps** | Use your Directory (tenant) ID from Entra ID → Overview. **Do not use `common`** if the app is single-tenant (AADSTS50194). For multi-tenant apps, `common` is OK. |
 * | `MICROSOFT_ADVERTISING_REPORT_TIME_ZONE` | No | `ReportTimeZone` enum for report date boundaries. Default `BrusselsCopenhagenMadridParis`. Not `UTC` — see Microsoft ReportTimeZone value set. |
 *
 * ## Per-customer settings (Config UI / Mongo `CustomerSettings`)
 *
 * - `bingAdsCustomerId` — Microsoft Advertising **Customer** ID (numeric, shown in Microsoft Advertising web UI).
 * - `bingAdsAccountId` — **Account** ID (numeric) for the ad account you want to report on.
 *
 * OAuth consent uses scope: `https://ads.microsoft.com/msads.manage offline_access`
 *
 * @see https://learn.microsoft.com/en-us/advertising/guides/authentication-oauth?view=bingads-13
 * @see https://learn.microsoft.com/en-us/advertising/reporting-service/reporting-service-operations?view=bingads-13
 */

import AdmZip from "adm-zip";
import { gunzipSync } from "node:zlib";

const REPORTING_NS = "https://bingads.microsoft.com/Reporting/v13";
const SERIALIZATION_NS = "http://schemas.microsoft.com/2003/10/Serialization/Arrays";
const REPORTING_ENDPOINT = "https://reporting.api.bingads.microsoft.com/Api/Advertiser/Reporting/v13/ReportingService.svc";

function xmlEscape(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function parseYmd(ymd) {
    const [y, m, d] = String(ymd).split("-").map((x) => parseInt(x, 10));
    return { Year: y, Month: m, Day: d };
}

/** Reports cannot end after "today" in the API; future end dates can stall or never complete. */
function clampReportEndDateToTodayUtc(endDate) {
    const t = new Date();
    const y = t.getUTCFullYear();
    const m = String(t.getUTCMonth() + 1).padStart(2, "0");
    const d = String(t.getUTCDate()).padStart(2, "0");
    const today = `${y}-${m}-${d}`;
    const e = String(endDate ?? "").trim();
    return e > today ? today : e;
}

function getEnv(name) {
    return process.env[name]?.trim() || "";
}

/** Microsoft `ReportTimeZone` value — not IANA names; `UTC` is invalid. @see ReportTimeZone value set in MS docs. */
function getReportTimeZone() {
    return (
        getEnv("MICROSOFT_ADVERTISING_REPORT_TIME_ZONE") || "BrusselsCopenhagenMadridParis"
    );
}

/** SOAP fault body — surface `faultstring` instead of opaque parse errors. */
function throwIfSoapFault(xml, operation) {
    if (!/<\s*s?:Fault\b/i.test(xml) && !/<\s*Fault\b/i.test(xml)) return;
    const m =
        xml.match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/i) ||
        xml.match(/<soap:Reason[^>]*>[\s\S]*?<soap:Text[^>]*>([^<]*)</i);
    const msg = m ? m[1].replace(/\s+/g, " ").trim().slice(0, 800) : "";
    throw new Error(
        msg ? `Microsoft Reporting (${operation}): ${msg}` : `Microsoft Reporting (${operation}): SOAP fault`
    );
}

/**
 * Returns true if all server credentials needed for live API calls are present.
 */
export function isMicrosoftAdvertisingConfigured() {
    return Boolean(
        getEnv("MICROSOFT_ADVERTISING_DEVELOPER_TOKEN") &&
            getEnv("MICROSOFT_ADVERTISING_CLIENT_ID") &&
            getEnv("MICROSOFT_ADVERTISING_CLIENT_SECRET") &&
            getEnv("MICROSOFT_ADVERTISING_REFRESH_TOKEN")
    );
}

export async function refreshMicrosoftAdvertisingAccessToken() {
    const clientId = getEnv("MICROSOFT_ADVERTISING_CLIENT_ID");
    const clientSecret = getEnv("MICROSOFT_ADVERTISING_CLIENT_SECRET");
    const refreshToken = getEnv("MICROSOFT_ADVERTISING_REFRESH_TOKEN");
    const tenant = getEnv("MICROSOFT_ADVERTISING_TENANT_ID") || "common";

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error(
            "Missing MICROSOFT_ADVERTISING_CLIENT_ID, MICROSOFT_ADVERTISING_CLIENT_SECRET, or MICROSOFT_ADVERTISING_REFRESH_TOKEN"
        );
    }

    const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
        scope: "https://ads.microsoft.com/msads.manage offline_access",
    });

    const res = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = json.error_description || json.error || JSON.stringify(json);
        throw new Error(`Microsoft token refresh failed: ${msg}`);
    }
    if (!json.access_token) {
        throw new Error("Microsoft token response missing access_token");
    }
    return json.access_token;
}

function reportingSoapHeaders({ accessToken, developerToken, customerId, accountId }) {
    return `<s:Header xmlns="${REPORTING_NS}">
    <Action mustUnderstand="1">SubmitGenerateReport</Action>
    <AuthenticationToken i:nil="false" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">${xmlEscape(accessToken)}</AuthenticationToken>
    <CustomerAccountId i:nil="false" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">${xmlEscape(accountId)}</CustomerAccountId>
    <CustomerId i:nil="false" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">${xmlEscape(customerId)}</CustomerId>
    <DeveloperToken i:nil="false" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">${xmlEscape(developerToken)}</DeveloperToken>
  </s:Header>`;
}

function pollSoapHeaders({ accessToken, developerToken, customerId, accountId }) {
    return `<s:Header xmlns="${REPORTING_NS}">
    <Action mustUnderstand="1">PollGenerateReport</Action>
    <AuthenticationToken i:nil="false" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">${xmlEscape(accessToken)}</AuthenticationToken>
    <CustomerAccountId i:nil="false" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">${xmlEscape(accountId)}</CustomerAccountId>
    <CustomerId i:nil="false" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">${xmlEscape(customerId)}</CustomerId>
    <DeveloperToken i:nil="false" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">${xmlEscape(developerToken)}</DeveloperToken>
  </s:Header>`;
}

function buildCampaignPerformanceReportRequestXml({ accountId, startDate, endDate, reportTimeZone }) {
    const s = parseYmd(startDate);
    const e = parseYmd(endDate);
    const cols = [
        "TimePeriod",
        "CampaignId",
        "CampaignName",
        "Impressions",
        "Clicks",
        "Spend",
        "Conversions",
        "Revenue",
    ];
    const columnXml = cols.map((c) => `<CampaignPerformanceReportColumn>${c}</CampaignPerformanceReportColumn>`).join("\n          ");

    return `<SubmitGenerateReportRequest xmlns="${REPORTING_NS}">
      <ReportRequest xmlns:i="http://www.w3.org/2001/XMLSchema-instance" i:type="CampaignPerformanceReportRequest">
        <ExcludeColumnHeaders i:nil="false">false</ExcludeColumnHeaders>
        <ExcludeReportFooter i:nil="false">true</ExcludeReportFooter>
        <ExcludeReportHeader i:nil="false">true</ExcludeReportHeader>
        <Format i:nil="false">Csv</Format>
        <FormatVersion>2.0</FormatVersion>
        <ReportName i:nil="false">ApexCampaignPerformance</ReportName>
        <ReturnOnlyCompleteData i:nil="false">false</ReturnOnlyCompleteData>
        <Aggregation>Daily</Aggregation>
        <Columns i:nil="false">
          ${columnXml}
        </Columns>
        <Scope i:nil="false">
          <AccountIds i:nil="false" xmlns:a1="${SERIALIZATION_NS}">
            <a1:long>${xmlEscape(accountId)}</a1:long>
          </AccountIds>
          <Campaigns i:nil="true" xmlns:i="http://www.w3.org/2001/XMLSchema-instance" />
        </Scope>
        <Time i:nil="false">
          <CustomDateRangeEnd i:nil="false">
            <Day>${e.Day}</Day>
            <Month>${e.Month}</Month>
            <Year>${e.Year}</Year>
          </CustomDateRangeEnd>
          <CustomDateRangeStart i:nil="false">
            <Day>${s.Day}</Day>
            <Month>${s.Month}</Month>
            <Year>${s.Year}</Year>
          </CustomDateRangeStart>
          <ReportTimeZone>${xmlEscape(reportTimeZone)}</ReportTimeZone>
        </Time>
      </ReportRequest>
    </SubmitGenerateReportRequest>`;
}

function extractXmlValue(xml, localNames) {
    for (const name of localNames) {
        const re = new RegExp(`<${name}[^>]*>([^<]*)</${name}>`, "i");
        const m = xml.match(re);
        if (m) return m[1].trim();
    }
    return null;
}

/** Decode minimal XML entities in text extracted from SOAP (e.g. URLs with &amp;). */
function decodeXmlText(s) {
    return String(s ?? "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"');
}

/**
 * Parses PollGenerateReport body only inside ReportRequestStatus so we don't match stray Status nodes,
 * and supports prefixed elements (e.g. a:ReportDownloadUrl) from WCF.
 */
function parsePollReportRequestStatus(xml) {
    const block =
        (xml.match(/<(?:[a-z0-9]+:)?ReportRequestStatus[^>]*>([\s\S]*?)<\/(?:[a-z0-9]+:)?ReportRequestStatus>/i) || [])[1] || "";
    if (!block) {
        return { status: "", downloadUrl: "" };
    }
    const statusLocal = "(?:[a-z0-9]+:)?Status";
    const urlLocal = "(?:[a-z0-9]+:)?ReportDownloadUrl";
    const stM = block.match(new RegExp(`<${statusLocal}[^>]*>([^<]*)</${statusLocal}>`, "i"));
    const status = stM ? stM[1].trim() : "";
    const urlNil = new RegExp(`<${urlLocal}[^>]*\\s[^>]*(?:i:nil|nil)="true"[^>]*/?>`, "i").test(block);
    if (urlNil) {
        return { status, downloadUrl: "" };
    }
    const emptySelf = new RegExp(`<${urlLocal}[^>]*/>`, "i").test(block);
    if (emptySelf && !new RegExp(`<${urlLocal}[^>]*>[^<]+</${urlLocal}>`, "i").test(block)) {
        return { status, downloadUrl: "" };
    }
    const urlM = block.match(new RegExp(`<${urlLocal}[^>]*>([^<]*)</${urlLocal}>`, "i"));
    const raw = urlM ? urlM[1].trim() : "";
    const downloadUrl = raw ? decodeXmlText(raw) : "";
    return { status, downloadUrl };
}

async function postReportingSoap({ soapAction, soapBody }) {
    const res = await fetch(REPORTING_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "text/xml; charset=utf-8",
            SOAPAction: soapAction,
        },
        body: soapBody,
    });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`Reporting HTTP ${res.status}: ${text.slice(0, 500)}`);
    }
    return text;
}

async function submitGenerateReport({ accessToken, developerToken, customerId, accountId, startDate, endDate }) {
    const reportTimeZone = getReportTimeZone();
    const envelope = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  ${reportingSoapHeaders({ accessToken, developerToken, customerId, accountId })}
  <s:Body>
    ${buildCampaignPerformanceReportRequestXml({ accountId, startDate, endDate, reportTimeZone })}
  </s:Body>
</s:Envelope>`;

    const xml = await postReportingSoap({
        soapAction: "SubmitGenerateReport",
        soapBody: envelope,
    });
    throwIfSoapFault(xml, "SubmitGenerateReport");
    const id =
        extractXmlValue(xml, ["ReportRequestId", "a:ReportRequestId"]) ||
        (xml.match(/ReportRequestId>([^<]+)</i) || [])[1];
    if (!id) {
        throw new Error(`SubmitGenerateReport: could not parse ReportRequestId. Response snippet: ${xml.slice(0, 800)}`);
    }
    return id;
}

async function pollGenerateReport({ accessToken, developerToken, customerId, accountId, reportRequestId }) {
    const body = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  ${pollSoapHeaders({ accessToken, developerToken, customerId, accountId })}
  <s:Body>
    <PollGenerateReportRequest xmlns="${REPORTING_NS}">
      <ReportRequestId>${xmlEscape(reportRequestId)}</ReportRequestId>
    </PollGenerateReportRequest>
  </s:Body>
</s:Envelope>`;

    const xml = await postReportingSoap({
        soapAction: "PollGenerateReport",
        soapBody: body,
    });
    throwIfSoapFault(xml, "PollGenerateReport");

    const { status, downloadUrl } = parsePollReportRequestStatus(xml);
    return { status: status || "", downloadUrl: downloadUrl || "" };
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function bufferLooksLikeGzip(buf) {
    return buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
}

/** Microsoft’s download is typically a .zip containing the CSV (see ReportRequestStatus.ReportDownloadUrl). */
function bufferLooksLikeZip(buf) {
    return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b;
}

function extractCsvFromMicrosoftReportZip(buf) {
    const zip = new AdmZip(buf);
    const csvEntries = zip.getEntries().filter((e) => !e.isDirectory && /\.csv$/i.test(e.entryName));
    const entry = csvEntries[0] || zip.getEntries().find((e) => !e.isDirectory);
    if (!entry) {
        throw new Error("Microsoft Advertising report ZIP contained no files");
    }
    return zip.readAsText(entry);
}

async function downloadReportCsv(url) {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
        throw new Error(`Report download failed: HTTP ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const enc = (res.headers.get("content-encoding") || "").toLowerCase();

    if (enc.includes("gzip") || bufferLooksLikeGzip(buf)) {
        return gunzipSync(buf).toString("utf8");
    }
    if (bufferLooksLikeZip(buf)) {
        return extractCsvFromMicrosoftReportZip(buf);
    }
    try {
        return gunzipSync(buf).toString("utf8");
    } catch {
        return buf.toString("utf8");
    }
}

function parseCsvLine(line) {
    const out = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            inQ = !inQ;
        } else if ((c === "," && !inQ) || c === "\r") {
            out.push(cur);
            cur = "";
        } else {
            cur += c;
        }
    }
    out.push(cur);
    return out.map((s) => s.replace(/^"|"$/g, "").trim());
}

function parseCampaignPerformanceCsv(csvText) {
    const normalized = String(csvText ?? "").replace(/^\uFEFF/, "");
    const lines = normalized.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    const header = parseCsvLine(lines[0]).map((h) => h.trim().replace(/^\uFEFF/, ""));
    const idx = (name) => {
        const i = header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
        return i >= 0 ? i : -1;
    };
    const iTime = idx("TimePeriod");
    const iCamp = idx("CampaignName");
    const iImp = idx("Impressions");
    const iClk = idx("Clicks");
    const iSpend = idx("Spend");
    const iConv = idx("Conversions");
    const iRev = idx("Revenue");

    if (iTime < 0) {
        throw new Error("CSV missing TimePeriod column");
    }

    const rows = [];
    for (let r = 1; r < lines.length; r++) {
        const cells = parseCsvLine(lines[r]);
        if (cells.length < header.length - 2 && cells.every((c) => !c)) continue;

        const timeRaw = (cells[iTime] || "").trim();
        let dateStr = timeRaw;
        const isoStart = timeRaw.match(/^(\d{4}-\d{2}-\d{2})/);
        if (isoStart) {
            dateStr = isoStart[1];
        } else {
            const mdy = timeRaw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if (mdy) {
                const mm = mdy[1].padStart(2, "0");
                const dd = mdy[2].padStart(2, "0");
                dateStr = `${mdy[3]}-${mm}-${dd}`;
            }
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;

        rows.push({
            date: dateStr,
            campaignName: iCamp >= 0 ? cells[iCamp] || "" : "",
            impressions: iImp >= 0 ? parseFloat(cells[iImp]) || 0 : 0,
            clicks: iClk >= 0 ? parseFloat(cells[iClk]) || 0 : 0,
            spend: iSpend >= 0 ? parseFloat(cells[iSpend]) || 0 : 0,
            conversions: iConv >= 0 ? parseFloat(cells[iConv]) || 0 : 0,
            revenue: iRev >= 0 ? parseFloat(cells[iRev]) || 0 : 0,
        });
    }
    return rows;
}

function aggregateToDashboard(rows) {
    const byDay = new Map();
    const byCampaign = new Map();

    for (const row of rows) {
        const d = row.date;
        if (!byDay.has(d)) {
            byDay.set(d, { impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 });
        }
        const agg = byDay.get(d);
        agg.impressions += row.impressions;
        agg.clicks += row.clicks;
        agg.spend += row.spend;
        agg.conversions += row.conversions;
        agg.revenue += row.revenue;

        const cname = row.campaignName || "Campaign";
        if (!byCampaign.has(cname)) {
            byCampaign.set(cname, { impressions: 0, clicks: 0, spend: 0, conversions: 0 });
        }
        const cagg = byCampaign.get(cname);
        cagg.impressions += row.impressions;
        cagg.clicks += row.clicks;
        cagg.spend += row.spend;
        cagg.conversions += row.conversions;
    }

    const dates = [...byDay.keys()].sort();
    const metrics_by_date = dates.map((date) => {
        const x = byDay.get(date);
        const imp = x.impressions;
        const clk = x.clicks;
        const spend = x.spend;
        return {
            date,
            ad_spend: Math.round(spend * 100) / 100,
            impressions: Math.round(imp),
            clicks: Math.round(clk),
            conversions: Math.round(x.conversions * 100) / 100,
            conversion_value: Math.round(x.revenue * 100) / 100,
            ctr: imp > 0 ? clk / imp : 0,
            cpc: clk > 0 ? spend / clk : 0,
            cpm: imp > 0 ? (spend / imp) * 1000 : 0,
        };
    });

    const top_campaigns = [...byCampaign.entries()]
        .map(([campaign_name, v]) => ({
            campaign_name,
            clicks: Math.round(v.clicks),
            impressions: Math.round(v.impressions),
            conversions: Math.round(v.conversions * 100) / 100,
            ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
        }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 10);

    return { metrics_by_date, top_campaigns, campaigns_by_date: [] };
}

function eachDateInclusiveYmd(startYmd, endYmd) {
    const dates = [];
    const [sy, sm, sd] = String(startYmd)
        .split("-")
        .map((x) => parseInt(x, 10));
    const [ey, em, ed] = String(endYmd)
        .split("-")
        .map((x) => parseInt(x, 10));
    const cur = new Date(Date.UTC(sy, sm - 1, sd));
    const end = new Date(Date.UTC(ey, em - 1, ed));
    if (cur > end) return dates;
    while (cur <= end) {
        dates.push(
            `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, "0")}-${String(cur.getUTCDate()).padStart(2, "0")}`
        );
        cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return dates;
}

function zeroMetricsRow(date) {
    return {
        date,
        ad_spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        conversion_value: 0,
        ctr: 0,
        cpc: 0,
        cpm: 0,
    };
}

/** Ensures one row per calendar day in [startYmd, endYmd] so dashboards can render cards/charts with zeros when there is no spend. */
function fillMetricsByDateRange(startYmd, endYmd, metrics_by_date) {
    const byDate = new Map(metrics_by_date.map((r) => [r.date, r]));
    return eachDateInclusiveYmd(startYmd, endYmd).map((d) => byDate.get(d) ?? zeroMetricsRow(d));
}

/** Microsoft SOAP uses xs:long / Int64 — alphanumeric values like Kontonummer (F118BTG2) are invalid. */
const MS_NUMERIC_ID = /^\d{1,19}$/;

function assertMicrosoftNumericId(fieldLabel, value) {
    const v = String(value ?? "").trim();
    if (!MS_NUMERIC_ID.test(v)) {
        throw new Error(
            `${fieldLabel} must be a numeric ID (Microsoft API uses Int64). ` +
                `The alphanumeric "Kontonummer" (e.g. F118BTG2) is not the Account ID — use the numeric **Konto-id** for Account ID, ` +
                `and the numeric Customer ID from Microsoft Advertising (not the account number).`
        );
    }
}

/**
 * Fetches campaign performance (daily) and returns the same JSON shape as the Bing demo dashboard.
 */
export async function fetchBingAdsDashboardMetrics({ customerId, accountId, startDate, endDate }) {
    assertMicrosoftNumericId("Microsoft Advertising Customer ID (bingAdsCustomerId)", customerId);
    assertMicrosoftNumericId("Microsoft Advertising Account ID (bingAdsAccountId)", accountId);

    const developerToken = getEnv("MICROSOFT_ADVERTISING_DEVELOPER_TOKEN");
    if (!developerToken) {
        throw new Error("Missing MICROSOFT_ADVERTISING_DEVELOPER_TOKEN");
    }

    const accessToken = await refreshMicrosoftAdvertisingAccessToken();

    const endClamped = clampReportEndDateToTodayUtc(endDate);
    let startUse = String(startDate ?? "").trim();
    if (startUse > endClamped) startUse = endClamped;

    const reportRequestId = await submitGenerateReport({
        accessToken,
        developerToken,
        customerId: String(customerId),
        accountId: String(accountId),
        startDate: startUse,
        endDate: endClamped,
    });

    let downloadUrl = "";
    let lastPollStatus = "";
    let resolvedSuccess = false;
    for (let attempt = 0; attempt < 36; attempt++) {
        const poll = await pollGenerateReport({
            accessToken,
            developerToken,
            customerId: String(customerId),
            accountId: String(accountId),
            reportRequestId,
        });
        lastPollStatus = poll.status || lastPollStatus;
        const st = (poll.status || "").toLowerCase();
        /** Microsoft: Status can be Success while ReportDownloadUrl is nil (no rows for the request). */
        if (st.includes("success")) {
            resolvedSuccess = true;
            downloadUrl = poll.downloadUrl || "";
            break;
        }
        if (st.includes("error") || st.includes("fail")) {
            throw new Error(`Report generation failed: ${poll.status}`);
        }
        await sleep(2000);
    }

    if (!resolvedSuccess) {
        const hint = lastPollStatus ? ` Last status: ${lastPollStatus}.` : "";
        throw new Error(
            `Timed out waiting for Microsoft Advertising report (PollGenerateReport).${hint} Try a shorter date range or retry.`
        );
    }

    let result;
    if (!downloadUrl) {
        result = aggregateToDashboard([]);
    } else {
        const csv = await downloadReportCsv(downloadUrl);
        const parsed = parseCampaignPerformanceCsv(csv);
        result = aggregateToDashboard(parsed);
    }
    result.metrics_by_date = fillMetricsByDateRange(startUse, endClamped, result.metrics_by_date);
    return result;
}
