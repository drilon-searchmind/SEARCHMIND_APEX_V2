import dbConnect from "./mongodb.js";
import { authenticateMcpOAuthJwt, looksLikeJwt } from "./mcpOAuthJwt.js";
import {
    authenticateMcpApiKey,
    MCP_KEY_ACCESS,
} from "./mcpApiKeyService.js";

/**
 * @param {Request} request
 * @returns {string | null}
 */
export function parseMcpBearerToken(request) {
    const auth = request.headers.get("authorization") || "";
    const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
    return match ? match[1].trim() : null;
}

/**
 * Validate MCP Bearer token from request headers.
 * @param {Request} request
 * @returns {Promise<
 *   | { ok: true, keyId: string, readOnly: true, scope: string }
 *   | { ok: false, status: number, error: string }
 * >}
 */
export async function validateMcpRequest(request) {
    const token = parseMcpBearerToken(request);
    if (!token) {
        return {
            ok: false,
            status: 401,
            error: "Missing Authorization Bearer token",
        };
    }

    await dbConnect();

    let auth = null;
    if (looksLikeJwt(token)) {
        try {
            auth = await authenticateMcpOAuthJwt(token);
        } catch {
            auth = null;
        }
    } else {
        auth = await authenticateMcpApiKey(token);
    }

    if (!auth) {
        return {
            ok: false,
            status: 401,
            error: "Invalid or revoked MCP credentials",
        };
    }

    return {
        ok: true,
        keyId: auth.keyId,
        readOnly: auth.readOnly,
        scope: auth.accessScope || MCP_KEY_ACCESS.scope,
        authMethod: auth.authMethod || "api_key",
    };
}
