"use client";

import React from "react";
import FormButton from "@/components/form/FormButton";
import FormInputText from "@/components/form/FormInputText";
import FormLabel from "@/components/form/FormLabel";
import { showToast } from "@/components/ui/ToastProvider";
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
        <div className="flex flex-col gap-8">
            <div>
                <h5 className="text-lg font-semibold text-[var(--color-primary-searchmind)] mb-1 flex items-center gap-2">
                    <FiKey />
                    MCP API keys
                </h5>
                <p className="text-sm text-gray-500 max-w-2xl">
                    Issue credentials for Claude Code, Cursor, and other MCP clients. Access is
                    read-only for all customers. For the <strong>Claude connector</strong>, use your{" "}
                    <strong>Google SSO Client ID</strong> (<code>SSO_GOOGLE_CLIENT_ID</code>) — leave
                    OAuth Client Secret empty. API keys and apex_oauth credentials are for CLI or
                    advanced use.
                </p>
            </div>

            {revealedCredentials && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 max-w-3xl space-y-4">
                    <p className="text-sm font-semibold text-amber-900">
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

                    <div className="text-xs text-amber-900/80 space-y-1 pt-1 border-t border-amber-200">
                        <p>
                            <span className="font-medium">MCP server URL:</span>{" "}
                            <code className="font-mono">{mcpServerUrl}/mcp</code>
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

                    <FormButton type="button" onClick={() => setRevealedCredentials(null)}>
                        Dismiss
                    </FormButton>
                </div>
            )}

            <form
                onSubmit={handleCreate}
                className="flex flex-col gap-4 max-w-3xl border border-gray-200 rounded-xl p-6"
            >
                <h6 className="text-sm font-semibold text-gray-800">Generate new credentials</h6>

                <div>
                    <FormLabel htmlFor="mcp-key-name">Label (optional)</FormLabel>
                    <FormInputText
                        id="mcp-key-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Claude Code — team"
                    />
                </div>

                <p className="text-xs text-gray-500">
                    Access: read-only · all customers · includes API key + OAuth client
                </p>

                <FormButton type="submit" disabled={creating}>
                    {creating ? "Generating…" : "Generate MCP credentials"}
                </FormButton>
            </form>

            <div>
                <h6 className="text-sm font-semibold text-gray-800 mb-3">Existing keys</h6>
                <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left">Prefix</th>
                                <th className="px-4 py-2 text-left">OAuth Client ID</th>
                                <th className="px-4 py-2 text-left">Label</th>
                                <th className="px-4 py-2 text-left">Access</th>
                                <th className="px-4 py-2 text-left">Created by</th>
                                <th className="px-4 py-2 text-left">Created</th>
                                <th className="px-4 py-2 text-left">Status</th>
                                <th className="px-4 py-2 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-4 text-gray-400">
                                        Loading…
                                    </td>
                                </tr>
                            ) : keys.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-4 text-gray-400">
                                        No MCP keys yet
                                    </td>
                                </tr>
                            ) : (
                                keys.map((k) => (
                                    <tr
                                        key={k.id}
                                        className={`border-t ${k.isRevoked ? "opacity-50" : ""}`}
                                    >
                                        <td className="px-4 py-2 font-mono text-xs">
                                            {k.keyPrefix}…
                                        </td>
                                        <td className="px-4 py-2 font-mono text-xs max-w-[12rem] truncate">
                                            {k.oauthClientId ? (
                                                <span title={k.oauthClientId}>
                                                    {k.oauthClientId}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 italic">
                                                    Regenerate for OAuth
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2">{k.name || "—"}</td>
                                        <td className="px-4 py-2 text-xs text-gray-600">
                                            Read-only · all customers
                                        </td>
                                        <td className="px-4 py-2 text-xs text-gray-600">
                                            {k.createdByName || "—"}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-600">
                                            {formatDate(k.createdAt)}
                                        </td>
                                        <td className="px-4 py-2">
                                            {k.isRevoked ? (
                                                <span className="text-red-600 text-xs font-medium">
                                                    Revoked
                                                </span>
                                            ) : (
                                                <span className="text-green-700 text-xs font-medium">
                                                    Active
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            {!k.isRevoked && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRevoke(k.id)}
                                                    disabled={revokingId === k.id}
                                                    className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 text-xs font-medium disabled:opacity-50"
                                                >
                                                    <FiTrash2 size={14} />
                                                    {revokingId === k.id ? "Revoking…" : "Revoke"}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function CredentialRow({ label, value, onCopy }) {
    return (
        <div>
            <p className="text-xs font-medium text-amber-900 mb-1">{label}</p>
            <div className="flex flex-wrap items-center gap-2">
                <code className="flex-1 min-w-0 break-all rounded-lg bg-white border border-amber-200 px-3 py-2 text-xs font-mono">
                    {value}
                </code>
                <FormButton type="button" onClick={onCopy}>
                    <span className="flex items-center gap-1">
                        <FiCopy size={14} />
                        Copy
                    </span>
                </FormButton>
            </div>
        </div>
    );
}
