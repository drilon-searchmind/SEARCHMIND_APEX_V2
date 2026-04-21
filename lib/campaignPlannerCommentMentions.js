/**
 * Parse @Display Name mentions in campaign planner comments (same rules as the LineItemModal UI).
 * Returns internal user ids (non-external, non-archived) that were mentioned.
 */

import mongoose from "mongoose";
import connectToDatabase from "./mongodb.js";
import User from "../models/User.js";
import { createNotificationsForUsers } from "./appNotificationOperations.js";

/**
 * @param {string} text
 * @param {Array<{ _id: unknown, name?: string }>} usersSortedByNameLengthDesc
 * @returns {string[]} unique user ids
 */
export function scanTextForAtMentions(text, usersSortedByNameLengthDesc) {
    const mentioned = new Set();
    const raw = text ?? "";
    let i = 0;
    while (i < raw.length) {
        if (raw[i] === "@") {
            const after = raw.slice(i + 1);
            let matchedLen = 0;
            let matchedId = null;
            for (const u of usersSortedByNameLengthDesc) {
                const n = (u.name || "").trim();
                if (!n) continue;
                if (after.startsWith(n)) {
                    const boundary = after[n.length];
                    if (
                        boundary === undefined ||
                        /\s/.test(boundary) ||
                        /[.,!?;:)\]"'…([{]/.test(boundary)
                    ) {
                        matchedId = String(u._id);
                        matchedLen = 1 + n.length;
                        break;
                    }
                }
            }
            if (matchedId) {
                mentioned.add(matchedId);
                i += matchedLen;
                continue;
            }
        }
        i++;
    }
    return [...mentioned];
}

let cachedUsersForMentions = null;
let cacheAt = 0;
const CACHE_MS = 60_000;

async function loadInternalUsersForMentionScan() {
    const now = Date.now();
    if (cachedUsersForMentions && now - cacheAt < CACHE_MS) {
        return cachedUsersForMentions;
    }
    await connectToDatabase();
    const users = await User.find({
        isExternal: { $ne: true },
        isArchived: { $ne: true },
    })
        .select("_id name")
        .lean();
    const sorted = [...users].sort(
        (a, b) => (b.name || "").length - (a.name || "").length
    );
    cachedUsersForMentions = sorted;
    cacheAt = now;
    return sorted;
}

/**
 * @returns {Promise<string[]>} Mentioned user ids (strings).
 */
export async function findMentionedInternalUserIds(text) {
    const users = await loadInternalUsersForMentionScan();
    return scanTextForAtMentions(text, users);
}

/**
 * Ids to notify: mentioned users minus author, optionally only those not in `previousText` (for edits).
 * @param {string | null | undefined} previousText
 */
export async function resolveRecipientIdsForMentionNotification(
    text,
    authorUserId,
    previousText = null
) {
    const newIds = await findMentionedInternalUserIds(text);
    const author = authorUserId != null ? String(authorUserId) : "";
    let ids = newIds.filter((id) => id !== author);
    if (previousText != null && previousText !== undefined) {
        const oldIds = new Set(await findMentionedInternalUserIds(previousText));
        ids = ids.filter((id) => !oldIds.has(id));
    }
    return [...new Set(ids)];
}

/**
 * @param {object} p
 * @param {string} p.customerId
 * @param {string} p.lineItemId
 * @param {string} p.authorUserId
 * @param {string} [p.authorName]
 * @param {string} [p.customerName]
 * @param {string} [p.campaignTypeName]
 * @param {string[]} p.recipientUserIds
 */
export async function sendCampaignPlannerMentionNotifications(p) {
    const {
        customerId,
        lineItemId,
        authorUserId,
        authorName = "",
        customerName = "",
        campaignTypeName = "",
        recipientUserIds,
    } = p;
    if (!recipientUserIds?.length) return { count: 0 };
    const cid = String(customerId || "").trim();
    const lid = String(lineItemId || "").trim();
    if (!cid || !lid) return { count: 0 };

    const title = "Mentioned in Campaign Planner";
    const who = (authorName || "Someone").trim();
    let body = `${who} mentioned you in a comment`;
    if (campaignTypeName) body += ` on “${campaignTypeName}”`;
    if (customerName) body += ` — ${customerName}`;
    body += ".";

    const linkUrl = `/dashboard/${cid}/campaign-planner-v2?lineItemId=${encodeURIComponent(lid)}`;

    const createdById =
        authorUserId && mongoose.Types.ObjectId.isValid(String(authorUserId))
            ? String(authorUserId)
            : null;

    return createNotificationsForUsers({
        title,
        body,
        linkUrl,
        category: "system",
        recipientUserIds,
        createdById,
    });
}
