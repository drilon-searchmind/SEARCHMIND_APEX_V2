"use client";

import React from "react";
import FormInputText from "@/components/form/FormInputText";
import FormLabel from "@/components/form/FormLabel";
import { showToast } from "@/components/ui/ToastProvider";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { FiCopy, FiKey, FiTrash2 } from "react-icons/fi";

function formatDate(value) {
    if (!value) return "—";
    try {
        return new Date(value).toLocaleString();
    } catch {
        return "—";
    }
}

export default function McpKeysTab() {
    const [keys, setKeys] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [creating, setCreating] = React.useState(false);
    const [revokingId, setRevokingId] = React.useState(null);

    const [name, setName] = React.useState("");
    const [revealedCredentials, setRevealedCredentials] = React.useState(null);

    const loadKeys = React.useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/mcp-keys");
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to load keys");
            setKeys(Array.isArray(data.keys) ? data.keys : []);
        } catch (err) {
            showToast({ type: "error", message: err.message || "Failed to load keys" });
            setKeys([]);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        loadKeys();
    }, [loadKeys]);

    const handleCreate = async (e) => {
        e.preventDefault();

        setCreating(true);
        try {
            const res = await fetch("/api/admin/mcp-keys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim() }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to create key");

            setRevealedCredentials({
                plaintext: data.plaintext,
                oauthClientId: data.oauthClientId,
                oauthClientSecret: data.oauthClientSecret,
                key: data.key,
            });
            setName("");
            await loadKeys();
            showToast({
                type: "success",
                message: "MCP credentials created — copy them now; secrets are shown only once",
            });
        } catch (err) {
            showToast({ type: "error", message: err.message || "Failed to create key" });
        } finally {
            setCreating(false);
        }
    };

    const handleRevoke = async (id) => {
        if (!window.confirm("Revoke this MCP key? It will stop working immediately.")) {
            return;
        }
        setRevokingId(id);
        try {
            const res = await fetch(`/api/admin/mcp-keys/${id}`, { method: "DELETE" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to revoke key");
            await loadKeys();
            showToast({ type: "success", message: "MCP key revoked" });
        } catch (err) {
            showToast({ type: "error", message: err.message || "Failed to revoke key" });
        } finally {
            setRevokingId(null);
        }
    };

    const copyText = async (text, label) => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            showToast({ type: "success", message: `${label} copied` });
        } catch {
            showToast({ type: "error", message: "Could not copy — select and copy manually" });
        }
    };

    const mcpServerUrl =
        process.env.NEXT_PUBLIC_MCP_SERVER_URL ||
        "https://mcp-server-apex-production.up.railway.app";

    return (
        <div className="apex-admin-tab apex-admin-stack-section">
            <div>
                <h2 className="apex-admin-section__title flex items-center gap-2">
                    <FiKey />
                    MCP API keys
                </h2>
                <p className="apex-admin-section__subtitle">
                    Issue credentials for Claude Code, Cursor, and other MCP clients. Access is
                    read-only for all customers. For the <strong>Claude connector</strong>, use your{" "}
                    <strong>Google SSO Client ID</strong> (<code>SSO_GOOGLE_CLIENT_ID</code>) —
                    leave OAuth Client Secret empty. API keys and apex_oauth credentials are for
                    CLI or advanced use.
                </p>
            </div>

            {revealedCredentials && (
                <div className="apex-admin-alert">
                    <p className="apex-admin-alert__title">
                        Copy these credentials now — they will not be shown again
                    </p>

                    <CredentialRow
                        label="API key (Bearer / CLI)"
                        value={revealedCredentials.plaintext}
                        onCopy={() => copyText(revealedCredentials.plaintext, "API key")}
                    />
                    <CredentialRow
                        label="OAuth Client ID (Claude connector)"
                        value={revealedCredentials.oauthClientId}
                        onCopy={() =>
                            copyText(revealedCredentials.oauthClientId, "OAuth Client ID")
                        }
                    />
                    <CredentialRow
                        label="OAuth Client Secret (Claude connector)"
                        value={revealedCredentials.oauthClientSecret}
                        onCopy={() =>
                            copyText(revealedCredentials.oauthClientSecret, "OAuth Client Secret")
                        }
                    />

                    <div className="apex-admin-alert__body pt-2 mt-2 border-t border-[var(--color-rule)]">
                        <p>
                            <strong>MCP server URL:</strong>{" "}
                            <code>{mcpServerUrl}/mcp</code>
                        </p>
                        <p>
                            <strong>Claude connector:</strong> OAuth Client ID = your Google SSO
                            client id (<code>SSO_GOOGLE_CLIENT_ID</code>). Leave secret empty. You
                            still need at least one active MCP key here for server-side access.
                        </p>
                        <p>
                            <strong>CLI / Bearer:</strong> use the API key above with{" "}
                            <code>Authorization: Bearer …</code>
                        </p>
                    </div>

                    <div className="apex-admin-actions mt-4">
                        <button
                            type="button"
                            className="apex-perf-btn apex-perf-btn--secondary"
                            onClick={() => setRevealedCredentials(null)}
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            <form onSubmit={handleCreate} className="apex-admin-form apex-admin-form--panel">
                <h3 className="apex-admin-subtitle-sm">Generate new credentials</h3>

                <div>
                    <FormLabel htmlFor="mcp-key-name">Label (optional)</FormLabel>
                    <FormInputText
                        id="mcp-key-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Claude Code — team"
                    />
                </div>

                <p className="apex-admin-field-hint">
                    Access: read-only · all customers · includes API key + OAuth client
                </p>

                <div className="apex-admin-actions">
                    <button
                        type="submit"
                        className="apex-perf-btn apex-perf-btn--primary"
                        disabled={creating}
                    >
                        {creating ? "Generating…" : "Generate MCP credentials"}
                    </button>
                </div>
            </form>

            <div>
                <h3 className="apex-admin-subtitle-sm mb-3">Existing keys</h3>
                <div className="apex-admin-table-wrap">
                    {loading ? (
                        <CobaltLoader variant="block" title="Loading MCP keys" />
                    ) : (
                        <table className="apex-admin-table">
                            <thead>
                                <tr>
                                    <th>Prefix</th>
                                    <th>OAuth Client ID</th>
                                    <th>Label</th>
                                    <th>Access</th>
                                    <th>Created by</th>
                                    <th>Created</th>
                                    <th>Status</th>
                                    <th className="is-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {keys.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="is-empty">
                                            No MCP keys yet
                                        </td>
                                    </tr>
                                ) : (
                                    keys.map((k) => (
                                        <tr key={k.id} className={k.isRevoked ? "opacity-50" : ""}>
                                            <td>
                                                <span className="apex-admin-cell-mono">
                                                    {k.keyPrefix}…
                                                </span>
                                            </td>
                                            <td>
                                                {k.oauthClientId ? (
                                                    <span
                                                        className="apex-admin-cell-mono"
                                                        title={k.oauthClientId}
                                                    >
                                                        {k.oauthClientId}
                                                    </span>
                                                ) : (
                                                    <span className="is-empty italic">
                                                        Regenerate for OAuth
                                                    </span>
                                                )}
                                            </td>
                                            <td>{k.name || "—"}</td>
                                            <td>Read-only · all customers</td>
                                            <td>{k.createdByName || "—"}</td>
                                            <td className="whitespace-nowrap">
                                                {formatDate(k.createdAt)}
                                            </td>
                                            <td>
                                                {k.isRevoked ? (
                                                    <span className="apex-admin-badge apex-admin-badge--error">
                                                        Revoked
                                                    </span>
                                                ) : (
                                                    <span className="apex-admin-badge apex-admin-badge--ok">
                                                        Active
                                                    </span>
                                                )}
                                            </td>
                                            <td className="is-right">
                                                {!k.isRevoked && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRevoke(k.id)}
                                                        disabled={revokingId === k.id}
                                                        className="apex-admin-link-btn apex-admin-link-btn--danger"
                                                    >
                                                        <FiTrash2 size={14} />
                                                        {revokingId === k.id
                                                            ? "Revoking…"
                                                            : "Revoke"}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

function CredentialRow({ label, value, onCopy }) {
    return (
        <div className="apex-admin-credential">
            <p className="apex-admin-credential__label">{label}</p>
            <div className="apex-admin-credential__row">
                <code className="apex-admin-credential__value">{value}</code>
                <button type="button" onClick={onCopy} className="apex-perf-btn apex-perf-btn--secondary apex-admin-btn-sm">
                    <span className="flex items-center gap-1">
                        <FiCopy size={14} />
                        Copy
                    </span>
                </button>
            </div>
        </div>
    );
}
