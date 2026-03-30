import connectToDatabase from "./mongodb.js";
import User from "../models/User.js";
import AppNotification from "../src/models/AppNotification.js";
import mongoose from "mongoose";

function serializeNotification(doc) {
    const o = doc.toObject ? doc.toObject() : doc;
    const author = o.createdBy && typeof o.createdBy === "object" ? o.createdBy : null;
    return {
        id: String(o._id),
        title: o.title,
        body: o.body,
        linkUrl: o.linkUrl || "",
        imageUrl: o.imageUrl || "",
        category: o.category || "system",
        readAt: o.readAt,
        createdAt: o.createdAt,
        authorName: author?.name || "",
        authorImage: author?.image || "",
    };
}

export async function countUnreadForUser(userId) {
    await connectToDatabase();
    if (!mongoose.Types.ObjectId.isValid(String(userId))) return 0;
    const uid = new mongoose.Types.ObjectId(String(userId));
    return AppNotification.countDocuments({ recipient: uid, readAt: null });
}

export async function listNotificationsForUser(userId, { limit = 20 } = {}) {
    await connectToDatabase();
    if (!mongoose.Types.ObjectId.isValid(String(userId))) return [];
    const uid = new mongoose.Types.ObjectId(String(userId));
    const docs = await AppNotification.find({ recipient: uid })
        .sort({ createdAt: -1 })
        .limit(Math.min(Number(limit) || 20, 200))
        .populate("createdBy", "name image")
        .exec();
    return docs.map(serializeNotification);
}

export async function markAllReadForUser(userId) {
    await connectToDatabase();
    if (!mongoose.Types.ObjectId.isValid(String(userId))) return;
    const uid = new mongoose.Types.ObjectId(String(userId));
    const now = new Date();
    await AppNotification.updateMany({ recipient: uid, readAt: null }, { $set: { readAt: now } });
}

/**
 * @param {object} payload — { title, body, linkUrl?, imageUrl?, category?, recipientUserIds: string[], createdById }
 */
export async function createNotificationsForUsers(payload) {
    await connectToDatabase();
    const {
        title,
        body,
        linkUrl = "",
        imageUrl = "",
        category = "system",
        recipientUserIds,
        createdById,
    } = payload;
    if (!title || !body || !Array.isArray(recipientUserIds) || recipientUserIds.length === 0) {
        throw new Error("title, body, and recipientUserIds are required");
    }
    const ids = [...new Set(recipientUserIds.map((id) => String(id)))].filter((id) =>
        mongoose.Types.ObjectId.isValid(id)
    );
    if (ids.length === 0) throw new Error("No valid recipient user ids");
    const author = createdById && mongoose.Types.ObjectId.isValid(createdById) ? createdById : null;
    const rows = ids.map((recipient) => ({
        recipient,
        title: String(title).trim(),
        body: String(body).trim(),
        linkUrl: String(linkUrl || "").trim(),
        imageUrl: String(imageUrl || "").trim(),
        category: ["system", "feature", "alert"].includes(category) ? category : "system",
        createdBy: author,
        readAt: null,
    }));
    await AppNotification.insertMany(rows);
    return { count: rows.length };
}

export async function resolveRecipientIdsForAudience(audience) {
    await connectToDatabase();
    if (audience === "allInternal") {
        const users = await User.find({ isArchived: { $ne: true }, isExternal: { $ne: true } }).select("_id");
        return users.map((u) => String(u._id));
    }
    if (audience === "allUsers") {
        const users = await User.find({ isArchived: { $ne: true } }).select("_id");
        return users.map((u) => String(u._id));
    }
    throw new Error('Invalid audience; use "allInternal" or "allUsers"');
}
