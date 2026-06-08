import crypto from "node:crypto";

import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import McpApiKey from "../models/McpApiKey.js";

const KEY_PREFIX = "apex_mcp_";
const OAUTH_CLIENT_ID_PREFIX = "apex_oauth_";
const OAUTH_CLIENT_SECRET_PREFIX = "apex_oauth_secret_";

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
 * @returns {string}
 */
export function generateMcpOAuthClientId() {
    return `${OAUTH_CLIENT_ID_PREFIX}${crypto.randomBytes(16).toString("base64url")}`;
}

/**
 * @returns {string}
 */
export function generateMcpOAuthClientSecret() {
    return `${OAUTH_CLIENT_SECRET_PREFIX}${crypto.randomBytes(32).toString("base64url")}`;
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
        oauthClientId: row.oauthClientId || "",
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
    const oauthClientId = generateMcpOAuthClientId();
    const oauthClientSecret = generateMcpOAuthClientSecret();
    const oauthClientSecretHash = await hashMcpApiKey(oauthClientSecret);

    const doc = await McpApiKey.create({
        name: String(input.name || "").trim(),
        keyHash,
        keyPrefix: mcpApiKeyDisplayPrefix(plaintext),
        oauthClientId,
        oauthClientSecretHash,
        readOnly: true,
        createdByUserId,
    });

    await doc.populate([{ path: "createdByUserId", select: "name email" }]);

    return {
        key: serializeKey(doc),
        plaintext,
        oauthClientId,
        oauthClientSecret,
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
 * Google SSO client id used for Claude connector (public client + PKCE).
 * @returns {string}
 */
export function getMcpGooglePublicClientId() {
    return String(
        process.env.SSO_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || ""
    ).trim();
}

/**
 * Claude connector may use the same Google OAuth client id as APEX SSO.
 * Access is still gated by @searchmind.dk Google login on the MCP server.
 *
 * @param {string} clientId
 */
export async function verifyMcpGooglePublicOAuthClient(clientId) {
    const id = String(clientId || "").trim();
    const googleId = getMcpGooglePublicClientId();
    if (!googleId || id !== googleId) return null;

    const configuredKeyId = String(process.env.MCP_OAUTH_KEY_ID || "").trim();
    if (configuredKeyId && mongoose.Types.ObjectId.isValid(configuredKeyId)) {
        const configured = await McpApiKey.findOne({
            _id: configuredKeyId,
            revokedAt: null,
        }).lean();
        if (configured) {
            return {
                keyId: String(configured._id),
                oauthClientId: googleId,
                readOnly: true,
                accessScope: MCP_KEY_ACCESS.scope,
                authMethod: "google_sso",
            };
        }
    }

    const fallback = await McpApiKey.findOne({ revokedAt: null })
        .sort({ createdAt: -1 })
        .lean();
    if (!fallback) return null;

    return {
        keyId: String(fallback._id),
        oauthClientId: googleId,
        readOnly: true,
        accessScope: MCP_KEY_ACCESS.scope,
        authMethod: "google_sso",
    };
}

/**
 * @param {string} clientId
 * @param {string} [clientSecret]
 */
export async function verifyMcpOAuthClient(clientId, clientSecret) {
    const id = String(clientId || "").trim();
    if (!id) return null;

    const row = await McpApiKey.findOne({
        oauthClientId: id,
        revokedAt: null,
    }).lean();

    if (!row) {
        return verifyMcpGooglePublicOAuthClient(id);
    }

    if (clientSecret !== undefined && clientSecret !== null && clientSecret !== "") {
        const ok = await verifyMcpApiKey(String(clientSecret), row.oauthClientSecretHash);
        if (!ok) return null;
    }

    return {
        keyId: String(row._id),
        oauthClientId: row.oauthClientId,
        readOnly: true,
        accessScope: MCP_KEY_ACCESS.scope,
        authMethod: "apex_oauth",
    };
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
