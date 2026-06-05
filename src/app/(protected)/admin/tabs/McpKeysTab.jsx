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
    const [revealedKey, setRevealedKey] = React.useState(null);

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

            setRevealedKey({
                plaintext: data.plaintext,
                key: data.key,
            });
            setName("");
            await loadKeys();
            showToast({
                type: "success",
                message: "MCP key created — copy it now; it won't be shown again",
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

    const copyPlaintext = async () => {
        if (!revealedKey?.plaintext) return;
        try {
            await navigator.clipboard.writeText(revealedKey.plaintext);
            showToast({ type: "success", message: "Copied to clipboard" });
        } catch {
            showToast({ type: "error", message: "Could not copy — select and copy manually" });
        }
    };

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h5 className="text-lg font-semibold text-[var(--color-primary-searchmind)] mb-1 flex items-center gap-2">
                    <FiKey />
                    MCP API keys
                </h5>
                <p className="text-sm text-gray-500 max-w-2xl">
                    Issue keys for Claude Code, Cursor, and other MCP clients. Each key grants
                    read-only access to all customers. Keys are stored hashed; the full secret
                    is shown only once at creation.
                </p>
            </div>

            {revealedKey && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 max-w-3xl">
                    <p className="text-sm font-semibold text-amber-900 mb-2">
                        Copy this key now — it will not be shown again
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        <code className="flex-1 min-w-0 break-all rounded-lg bg-white border border-amber-200 px-3 py-2 text-xs font-mono">
                            {revealedKey.plaintext}
                        </code>
                        <FormButton type="button" onClick={copyPlaintext}>
                            <span className="flex items-center gap-1">
                                <FiCopy size={14} />
                                Copy
                            </span>
                        </FormButton>
                        <FormButton type="button" onClick={() => setRevealedKey(null)}>
                            Dismiss
                        </FormButton>
                    </div>
                </div>
            )}

            <form
                onSubmit={handleCreate}
                className="flex flex-col gap-4 max-w-3xl border border-gray-200 rounded-xl p-6"
            >
                <h6 className="text-sm font-semibold text-gray-800">Generate new key</h6>

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
                    Access: read-only · all customers · all users
                </p>

                <FormButton type="submit" disabled={creating}>
                    {creating ? "Generating…" : "Generate MCP key"}
                </FormButton>
            </form>

            <div>
                <h6 className="text-sm font-semibold text-gray-800 mb-3">Existing keys</h6>
                <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left">Prefix</th>
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
                                    <td colSpan={7} className="px-4 py-4 text-gray-400">
                                        Loading…
                                    </td>
                                </tr>
                            ) : keys.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-4 text-gray-400">
                                        No MCP keys yet
                                    </td>
                                </tr>
                            ) : (
                                keys.map((k) => (
                                    <tr
                                        key={k.id}
                                        className={`border-t ${k.isRevoked ? "opacity-50" : ""}`}
                                    >
                                        <td className="px-4 py-2 font-mono text-xs">{k.keyPrefix}…</td>
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
