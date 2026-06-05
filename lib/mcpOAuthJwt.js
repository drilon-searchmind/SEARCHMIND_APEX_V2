import crypto from "node:crypto";

import McpApiKey from "../models/McpApiKey.js";
import { MCP_KEY_ACCESS } from "./mcpApiKeyService.js";

const JWT_TYP = "mcp_oauth";

function getJwtSecret() {
    const s = String(process.env.MCP_OAUTH_JWT_SECRET || "").trim();
    if (!s || s.length < 32) {
        throw new Error("MCP_OAUTH_JWT_SECRET must be set (min 32 characters)");
    }
    return s;
}

function b64url(input) {
    return Buffer.from(input).toString("base64url");
}

function b64urlJson(obj) {
    return b64url(JSON.stringify(obj));
}

/**
 * @param {string} token
 */
export function looksLikeJwt(token) {
    const parts = String(token || "").split(".");
    return parts.length === 3 && parts.every((p) => p.length > 0);
}

/**
 * @param {string} token
 */
export function verifyMcpOAuthJwt(token) {
    const secret = getJwtSecret();
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, sigB64] = parts;
    const data = `${headerB64}.${payloadB64}`;
    const expected = crypto
        .createHmac("sha256", secret)
        .update(data)
        .digest("base64url");

    if (expected !== sigB64) return null;

    let payload;
    try {
        payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    } catch {
        return null;
    }

    if (payload.typ !== JWT_TYP) return null;
    if (payload.exp && Date.now() / 1000 > Number(payload.exp)) return null;

    return payload;
}

/**
 * @param {string} token
 */
export async function authenticateMcpOAuthJwt(token) {
    const payload = verifyMcpOAuthJwt(token);
    if (!payload?.keyId) return null;

    const row = await McpApiKey.findById(payload.keyId).lean();
    if (!row || row.revokedAt) return null;

    await McpApiKey.updateOne(
        { _id: row._id },
        { $set: { lastUsedAt: new Date() } }
    );

    return {
        keyId: String(row._id),
        readOnly: true,
        accessScope: MCP_KEY_ACCESS.scope,
        email: payload.email || null,
        oauthClientId: payload.client_id || row.oauthClientId || null,
        authMethod: "oauth",
    };
}
