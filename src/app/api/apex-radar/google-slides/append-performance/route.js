import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { GoogleAuth } from "google-auth-library";
import crypto from "crypto";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServiceAccountCredentialsForSlides } from "@/lib/googleSlidesServiceAccount";
import { buildPerformanceInvestigatorSlidesApiPlan } from "@/lib/apexRadarPerformanceInvestigatorCopy";

const SLIDES_SCOPE = "https://www.googleapis.com/auth/presentations";
const MAX_CHARS = 95000;
const BATCH_CHUNK = 380;

/** Match Performance Investigator monthly table header groups */
const GROUP_HEADER_HEX = ["#1e2b2b", "#3b5252", "#5e8888"];

function rgbFromHex(hex) {
    const n = hex.replace("#", "");
    return {
        red: parseInt(n.slice(0, 2), 16) / 255,
        green: parseInt(n.slice(2, 4), 16) / 255,
        blue: parseInt(n.slice(4, 6), 16) / 255,
    };
}

/** TextStyle.foregroundColor — OptionalColor */
function optionalColorFromHex(hex) {
    return { opaqueColor: { rgbColor: rgbFromHex(hex) } };
}

/** SolidFill.color — OpaqueColor (not wrapped in OptionalColor) */
function solidFillOpaqueColorFromHex(hex) {
    return { rgbColor: rgbFromHex(hex) };
}

function columnGroupIndex(colIdx) {
    if (colIdx <= 4) return 0;
    if (colIdx <= 6) return 1;
    return 2;
}

function isFooterLabel(firstCell) {
    return typeof firstCell === "string" && /^Total/i.test(firstCell.trim());
}

/** Empty insertText("") creates no text run; updateTextStyle then fails ("object has no text"). */
function tableCellText(raw) {
    const s = String(raw ?? "").replace(/\t/g, " ");
    return s.length > 0 ? s : "\u200b";
}

function estimatePlanChars(plan) {
    let n = 0;
    for (const s of plan.slides) {
        if (s.kind === "intro") {
            n += (s.title || "").length + (s.lines || []).join("\n").length;
        } else if (s.headerRow && s.dataRows) {
            n += (s.slideTitle || "").length;
            n += s.headerRow.join("").length;
            for (const row of s.dataRows) n += row.join("").length;
        }
    }
    return n;
}

function pushTableSlide(requests, { slideObjectId, titleShapeId, tableObjectId, slideTitle, headerRow, dataRows }) {
    const numRows = 1 + dataRows.length;
    const numCols = headerRow.length;
    const tableHeight = Math.min(430, Math.max(120, 18 * numRows + 24));

    requests.push({
        createSlide: {
            objectId: slideObjectId,
            slideLayoutReference: { predefinedLayout: "BLANK" },
        },
    });
    requests.push({
        createShape: {
            objectId: titleShapeId,
            shapeType: "TEXT_BOX",
            elementProperties: {
                pageObjectId: slideObjectId,
                size: {
                    width: { magnitude: 648, unit: "PT" },
                    height: { magnitude: 40, unit: "PT" },
                },
                transform: {
                    scaleX: 1,
                    scaleY: 1,
                    translateX: 36,
                    translateY: 24,
                    unit: "PT",
                },
            },
        },
    });
    requests.push({
        insertText: {
            objectId: titleShapeId,
            insertionIndex: 0,
            text: tableCellText(slideTitle),
        },
    });
    requests.push({
        updateTextStyle: {
            objectId: titleShapeId,
            style: {
                bold: true,
                fontSize: { magnitude: 14, unit: "PT" },
                foregroundColor: optionalColorFromHex("#111827"),
            },
            fields: "bold,fontSize,foregroundColor",
            textRange: { type: "ALL" },
        },
    });

    requests.push({
        createTable: {
            objectId: tableObjectId,
            elementProperties: {
                pageObjectId: slideObjectId,
                size: {
                    width: { magnitude: 648, unit: "PT" },
                    height: { magnitude: tableHeight, unit: "PT" },
                },
                transform: {
                    scaleX: 1,
                    scaleY: 1,
                    translateX: 36,
                    translateY: 68,
                    unit: "PT",
                },
            },
            rows: numRows,
            columns: numCols,
        },
    });

    for (let c = 0; c < numCols; c++) {
        requests.push({
            insertText: {
                objectId: tableObjectId,
                cellLocation: { rowIndex: 0, columnIndex: c },
                insertionIndex: 0,
                text: tableCellText(headerRow[c]),
            },
        });
    }

    for (let r = 0; r < dataRows.length; r++) {
        const row = dataRows[r] || [];
        for (let c = 0; c < numCols; c++) {
            requests.push({
                insertText: {
                    objectId: tableObjectId,
                    cellLocation: { rowIndex: r + 1, columnIndex: c },
                    insertionIndex: 0,
                    text: tableCellText(row[c]),
                },
            });
        }
    }

    const headerBgHex = (col) => GROUP_HEADER_HEX[columnGroupIndex(col)];

    for (let c = 0; c < numCols; c++) {
        requests.push({
            updateTableCellProperties: {
                objectId: tableObjectId,
                tableRange: {
                    location: { rowIndex: 0, columnIndex: c },
                    rowSpan: 1,
                    columnSpan: 1,
                },
                tableCellProperties: {
                    tableCellBackgroundFill: {
                        solidFill: { color: solidFillOpaqueColorFromHex(headerBgHex(c)) },
                    },
                },
                fields: "tableCellBackgroundFill",
            },
        });
        requests.push({
            updateTextStyle: {
                objectId: tableObjectId,
                cellLocation: { rowIndex: 0, columnIndex: c },
                textRange: { type: "ALL" },
                style: {
                    bold: true,
                    fontSize: { magnitude: 7, unit: "PT" },
                    foregroundColor: optionalColorFromHex("#ffffff"),
                },
                fields: "bold,fontSize,foregroundColor",
            },
        });
    }

    for (let r = 0; r < dataRows.length; r++) {
        const footer = isFooterLabel(dataRows[r]?.[0]);
        const bg = footer ? "#e5e7eb" : r % 2 === 1 ? "#f9fafb" : "#ffffff";
        for (let c = 0; c < numCols; c++) {
            requests.push({
                updateTableCellProperties: {
                    objectId: tableObjectId,
                    tableRange: {
                        location: { rowIndex: r + 1, columnIndex: c },
                        rowSpan: 1,
                        columnSpan: 1,
                    },
                    tableCellProperties: {
                        tableCellBackgroundFill: {
                            solidFill: { color: solidFillOpaqueColorFromHex(bg) },
                        },
                    },
                    fields: "tableCellBackgroundFill",
                },
            });
            if (footer) {
                requests.push({
                    updateTextStyle: {
                        objectId: tableObjectId,
                        cellLocation: { rowIndex: r + 1, columnIndex: c },
                        textRange: { type: "ALL" },
                        style: { bold: true, fontSize: { magnitude: 7, unit: "PT" } },
                        fields: "bold,fontSize",
                    },
                });
            } else {
                requests.push({
                    updateTextStyle: {
                        objectId: tableObjectId,
                        cellLocation: { rowIndex: r + 1, columnIndex: c },
                        textRange: { type: "ALL" },
                        style: { fontSize: { magnitude: 7, unit: "PT" } },
                        fields: "fontSize",
                    },
                });
            }
        }
    }
}

function pushFunnelTableSlide(requests, { slideObjectId, titleShapeId, tableObjectId, slideTitle, headerRow, dataRows }) {
    const rows = dataRows.length ? dataRows : [["No funnel data", "—", "—"]];
    pushTableSlide(requests, {
        slideObjectId,
        titleShapeId,
        tableObjectId,
        slideTitle,
        headerRow,
        dataRows: rows,
    });
}

function buildDeckRequests(plan, rid) {
    const requests = [];
    let idx = 0;

    for (const slide of plan.slides) {
        const sid = `pi_${rid}_s${idx}`;
        if (slide.kind === "intro") {
            const titleBox = `pi_${rid}_t${idx}`;
            const bodyBox = `pi_${rid}_b${idx}`;
            const title = slide.title || "Performance Investigator";
            const body = (slide.lines || []).filter(Boolean).join("\n");

            requests.push({
                createSlide: {
                    objectId: sid,
                    slideLayoutReference: { predefinedLayout: "BLANK" },
                },
            });
            requests.push({
                createShape: {
                    objectId: titleBox,
                    shapeType: "TEXT_BOX",
                    elementProperties: {
                        pageObjectId: sid,
                        size: {
                            width: { magnitude: 648, unit: "PT" },
                            height: { magnitude: 72, unit: "PT" },
                        },
                        transform: {
                            scaleX: 1,
                            scaleY: 1,
                            translateX: 36,
                            translateY: 36,
                            unit: "PT",
                        },
                    },
                },
            });
            requests.push({
                insertText: {
                    objectId: titleBox,
                    insertionIndex: 0,
                    text: title,
                },
            });
            requests.push({
                updateTextStyle: {
                    objectId: titleBox,
                    style: {
                        bold: true,
                        fontSize: { magnitude: 20, unit: "PT" },
                        foregroundColor: optionalColorFromHex("#111827"),
                    },
                    fields: "bold,fontSize,foregroundColor",
                    textRange: { type: "ALL" },
                },
            });
            requests.push({
                createShape: {
                    objectId: bodyBox,
                    shapeType: "TEXT_BOX",
                    elementProperties: {
                        pageObjectId: sid,
                        size: {
                            width: { magnitude: 648, unit: "PT" },
                            height: { magnitude: 360, unit: "PT" },
                        },
                        transform: {
                            scaleX: 1,
                            scaleY: 1,
                            translateX: 36,
                            translateY: 120,
                            unit: "PT",
                        },
                    },
                },
            });
            requests.push({
                insertText: {
                    objectId: bodyBox,
                    insertionIndex: 0,
                    text: body || "\u00A0",
                },
            });
            requests.push({
                updateTextStyle: {
                    objectId: bodyBox,
                    style: {
                        fontSize: { magnitude: 11, unit: "PT" },
                        foregroundColor: optionalColorFromHex("#374151"),
                    },
                    fields: "fontSize,foregroundColor",
                    textRange: { type: "ALL" },
                },
            });
        } else if (slide.kind === "metricsTable") {
            const titleShapeId = `pi_${rid}_h${idx}`;
            const tableObjectId = `pi_${rid}_tbl${idx}`;
            pushTableSlide(requests, {
                slideObjectId: sid,
                titleShapeId,
                tableObjectId,
                slideTitle: slide.slideTitle,
                headerRow: slide.headerRow,
                dataRows: slide.dataRows,
            });
        } else if (slide.kind === "diffTable") {
            const titleShapeId = `pi_${rid}_h${idx}`;
            const tableObjectId = `pi_${rid}_tbl${idx}`;
            pushTableSlide(requests, {
                slideObjectId: sid,
                titleShapeId,
                tableObjectId,
                slideTitle: slide.slideTitle,
                headerRow: slide.headerRow,
                dataRows: slide.dataRows,
            });
        } else if (slide.kind === "funnelTable") {
            const titleShapeId = `pi_${rid}_h${idx}`;
            const tableObjectId = `pi_${rid}_tbl${idx}`;
            pushFunnelTableSlide(requests, {
                slideObjectId: sid,
                titleShapeId,
                tableObjectId,
                slideTitle: slide.slideTitle,
                headerRow: slide.headerRow,
                dataRows: slide.dataRows,
            });
        }
        idx += 1;
    }

    return requests;
}

async function postBatches(presentationId, token, allRequests) {
    const url = `https://slides.googleapis.com/v1/presentations/${encodeURIComponent(presentationId)}:batchUpdate`;
    for (let i = 0; i < allRequests.length; i += BATCH_CHUNK) {
        const chunk = allRequests.slice(i, i + BATCH_CHUNK);
        const res = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ requests: chunk }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const msg =
                data?.error?.message ||
                (typeof data?.error === "string" ? data.error : null) ||
                `Slides API error (${res.status})`;
            const err = new Error(msg);
            err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
            err.data = data;
            throw err;
        }
    }
}

/**
 * POST — append slides with PI tables (one slide per section).
 * Body: { presentationId, exportPayload } — same shape as PerformanceInvestigatorCopyToSlides exportPayload.
 */
export async function POST(req) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const credentials = getServiceAccountCredentialsForSlides();
    if (!credentials?.client_email || !credentials?.private_key) {
        return NextResponse.json(
            { error: "Google Slides append is not configured on this server" },
            { status: 503 }
        );
    }

    let body;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const presentationId = typeof body.presentationId === "string" ? body.presentationId.trim() : "";
    const exportPayload = body.exportPayload && typeof body.exportPayload === "object" ? body.exportPayload : null;

    if (!presentationId || !/^[a-zA-Z0-9_-]+$/.test(presentationId)) {
        return NextResponse.json({ error: "Invalid presentationId" }, { status: 400 });
    }
    if (!exportPayload) {
        return NextResponse.json({ error: "Missing exportPayload" }, { status: 400 });
    }

    let plan;
    try {
        plan = buildPerformanceInvestigatorSlidesApiPlan(exportPayload);
    } catch (e) {
        return NextResponse.json({ error: e?.message || "Invalid export payload" }, { status: 400 });
    }

    if (!plan?.slides?.length) {
        return NextResponse.json({ error: "Nothing to export" }, { status: 400 });
    }

    const charEst = estimatePlanChars(plan);
    if (charEst > MAX_CHARS) {
        return NextResponse.json(
            {
                error: "Export is too large for a single append. Reduce the date range or data and try again.",
            },
            { status: 413 }
        );
    }

    const rid = crypto.randomBytes(8).toString("hex");
    let requests;
    try {
        requests = buildDeckRequests(plan, rid);
    } catch (e) {
        return NextResponse.json({ error: e?.message || "Could not build slide requests" }, { status: 500 });
    }

    const auth = new GoogleAuth({
        credentials,
        scopes: [SLIDES_SCOPE],
    });
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();
    if (!token) {
        return NextResponse.json({ error: "Could not obtain access token" }, { status: 500 });
    }

    try {
        await postBatches(presentationId, token, requests);
    } catch (e) {
        const status = e.status || 502;
        return NextResponse.json(
            {
                error: e.message || "Slides API error",
                hint:
                    "Share the presentation with the service account email as Editor, or check the presentation ID.",
            },
            { status }
        );
    }

    const slideCount = plan.slides.length;
    return NextResponse.json({
        ok: true,
        slideCount,
        message: `Added ${slideCount} slides with formatted tables. Open Google Slides to review.`,
    });
}
