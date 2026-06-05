import crypto from "node:crypto";

import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import McpApiKey from "../models/McpApiKey.js";

const KEY_PREFIX = "apex_mcp_";

/** All keys grant read-only access to all customers (enforced at MCP/API layer). */
export const MCP_KEY_ACCESS = {
    readOnly: true,
    scope: "all",
};

/**
 * @returns {string}
 */
export function generateMcpApiKeyPlaintext() {
    const secret = crypto.randomBytes(32).toString("base64url");
    return `${KEY_PREFIX}${secret}`;
}

/**
 * @param {string} plaintext
 * @returns {string}
 */
export function mcpApiKeyDisplayPrefix(plaintext) {
    return plaintext.slice(0, Math.min(plaintext.length, 20));
}

/**
 * @param {string} plaintext
 */
export async function hashMcpApiKey(plaintext) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(plaintext, salt);
}

/**
 * @param {string} plaintext
 * @param {string} hash
 */
export async function verifyMcpApiKey(plaintext, hash) {
    if (!plaintext || !hash) return false;
    return bcrypt.compare(plaintext, hash);
}

function serializeKey(doc) {
    if (!doc) return null;
    const row = doc.toObject ? doc.toObject() : { ...doc };
    return {
        id: String(row._id),
        name: row.name || "",
        keyPrefix: row.keyPrefix,
        readOnly: row.readOnly !== false,
        accessScope: MCP_KEY_ACCESS.scope,
        createdByUserId: row.createdByUserId
            ? String(row.createdByUserId._id || row.createdByUserId)
            : null,
        createdByName: row.createdByUserId?.name || null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        revokedAt: row.revokedAt || null,
        lastUsedAt: row.lastUsedAt || null,
        isRevoked: Boolean(row.revokedAt),
    };
}

export async function listMcpApiKeysForAdmin() {
    const rows = await McpApiKey.find()
        .sort({ createdAt: -1 })
        .populate("createdByUserId", "name email")
        .lean();

    return rows.map((row) => serializeKey(row));
}

/**
 * @param {{
 *   name?: string,
 *   createdByUserId: string,
 * }} input
 */
export async function createMcpApiKey(input) {
    const createdByUserId = String(input.createdByUserId || "").trim();

    if (!mongoose.Types.ObjectId.isValid(createdByUserId)) {
        throw new Error("Invalid creator");
    }

    const plaintext = generateMcpApiKeyPlaintext();
    const keyHash = await hashMcpApiKey(plaintext);

    const doc = await McpApiKey.create({
        name: String(input.name || "").trim(),
        keyHash,
        keyPrefix: mcpApiKeyDisplayPrefix(plaintext),
        readOnly: true,
        createdByUserId,
    });

    await doc.populate([{ path: "createdByUserId", select: "name email" }]);

    return {
        key: serializeKey(doc),
        plaintext,
    };
}

/**
 * @param {string} keyId
 * @param {{ name?: string }} updates
 */
export async function updateMcpApiKey(keyId, updates) {
    if (!mongoose.Types.ObjectId.isValid(keyId)) {
        throw new Error("Invalid key id");
    }

    const doc = await McpApiKey.findById(keyId);
    if (!doc) throw new Error("Key not found");
    if (doc.revokedAt) throw new Error("Cannot update a revoked key");

    if (updates.name !== undefined) {
        doc.name = String(updates.name || "").trim();
    }

    await doc.save();
    await doc.populate([{ path: "createdByUserId", select: "name email" }]);

    return serializeKey(doc);
}

/**
 * @param {string} plaintext
 */
export async function authenticateMcpApiKey(plaintext) {
    const token = String(plaintext || "").trim();
    if (!token.startsWith(KEY_PREFIX)) return null;

    const prefix = mcpApiKeyDisplayPrefix(token);
    const candidates = await McpApiKey.find({
        revokedAt: null,
        keyPrefix: prefix,
    }).lean();

    for (const row of candidates) {
        const ok = await verifyMcpApiKey(token, row.keyHash);
        if (!ok) continue;

        await McpApiKey.updateOne(
            { _id: row._id },
            { $set: { lastUsedAt: new Date() } }
        );

        return {
            keyId: String(row._id),
            readOnly: true,
            accessScope: MCP_KEY_ACCESS.scope,
        };
    }

    return null;
}

/**
 * @param {string} keyId
 * @param {string} revokedByUserId
 */
export async function revokeMcpApiKey(keyId, revokedByUserId) {
    if (!mongoose.Types.ObjectId.isValid(keyId)) {
        throw new Error("Invalid key id");
    }

    const doc = await McpApiKey.findById(keyId);
    if (!doc) throw new Error("Key not found");
    if (doc.revokedAt) return serializeKey(doc);

    doc.revokedAt = new Date();
    if (mongoose.Types.ObjectId.isValid(revokedByUserId)) {
        doc.revokedByUserId = revokedByUserId;
    }
    await doc.save();
    await doc.populate([{ path: "createdByUserId", select: "name email" }]);

    return serializeKey(doc);
}
