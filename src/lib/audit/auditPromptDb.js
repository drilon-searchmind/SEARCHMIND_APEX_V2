import mongoose from "mongoose";
import connectToDatabase from "@root/lib/mongodb";
import AuditPrompt from "@/models/AuditPrompt";
import AuditPromptSelection from "@/models/AuditPromptSelection";
import AuditPromptTemplate from "@/models/AuditPromptTemplate";
import {
    AUDIT_CHANNEL_SCOPES,
    AUDIT_PROMPT_SCOPES,
    AUDIT_SCOPE_META,
} from "./auditPromptScopes";
import { AUDIT_PROMPT_SEED_DEFAULTS } from "./auditPromptDefaults";

const CONFIG_KEY = "default";
const CACHE_MS = 30_000;

/** @type {{ at: number, system: string, channels: Record<string, string> } | null} */
let runtimeCache = null;

export function invalidateAuditPromptCache() {
    runtimeCache = null;
}

function serializePrompt(doc) {
    if (!doc) return null;
    const id = String(doc._id);
    return {
        id,
        scope: doc.scope,
        title: doc.title,
        description: doc.description || "",
        body: String(doc.body || "").trim(),
        sortOrder: doc.sortOrder ?? 0,
        updatedAt: doc.updatedAt,
        createdAt: doc.createdAt,
    };
}

/**
 * @param {import('mongoose').Document|null} sel
 */
function serializeSelection(sel) {
    const channels = {};
    for (const ch of AUDIT_CHANNEL_SCOPES) {
        channels[ch] = sel?.channelPromptIds?.[ch]
            ? String(sel.channelPromptIds[ch])
            : null;
    }
    return {
        systemPromptId: sel?.systemPromptId ? String(sel.systemPromptId) : null,
        channels,
    };
}

async function getOrCreateSelectionDoc() {
    await connectToDatabase();
    let sel = await AuditPromptSelection.findOne({ configKey: CONFIG_KEY });
    if (!sel) {
        sel = await AuditPromptSelection.create({ configKey: CONFIG_KEY });
    }
    return sel;
}

/**
 * Ensure each scope has at least one prompt and each scope has a selection when possible.
 */
export async function ensureAuditPromptLibrary() {
    await connectToDatabase();

    const count = await AuditPrompt.countDocuments();
    if (count === 0) {
        const legacy = await AuditPromptTemplate.find({}).sort({ sortOrder: 1 }).lean();
        if (legacy.length > 0) {
            /** @type {Record<string, import('mongoose').Types.ObjectId>} */
            const firstByScope = {};
            for (const row of legacy) {
                const scope = row.slug === "system" ? "system" : "cross";
                const created = await AuditPrompt.create({
                    scope,
                    title: row.title || row.slug,
                    description: row.description || "",
                    body: String(row.body || "").trim(),
                    sortOrder: row.sortOrder ?? 0,
                });
                if (!firstByScope[scope]) firstByScope[scope] = created._id;
            }
            const sel = await getOrCreateSelectionDoc();
            if (firstByScope.system) sel.systemPromptId = firstByScope.system;
            if (firstByScope.cross) sel.channelPromptIds.cross = firstByScope.cross;
            await sel.save();
        } else {
            /** @type {Record<string, import('mongoose').Types.ObjectId>} */
            const firstByScope = {};
            for (const def of AUDIT_PROMPT_SEED_DEFAULTS) {
                const created = await AuditPrompt.create({
                    scope: def.scope,
                    title: def.title,
                    description: def.description,
                    body: def.body,
                    sortOrder: def.sortOrder,
                });
                if (!firstByScope[def.scope]) firstByScope[def.scope] = created._id;
            }
            const sel = await getOrCreateSelectionDoc();
            for (const scope of AUDIT_PROMPT_SCOPES) {
                const id = firstByScope[scope];
                if (!id) continue;
                if (scope === "system") sel.systemPromptId = id;
                else sel.channelPromptIds[scope] = id;
            }
            await sel.save();
        }
    }

    const sel = await getOrCreateSelectionDoc();
    for (const scope of AUDIT_PROMPT_SCOPES) {
        const scopeCount = await AuditPrompt.countDocuments({ scope });
        if (scopeCount === 0) {
            const def = AUDIT_PROMPT_SEED_DEFAULTS.find((d) => d.scope === scope);
            if (def) {
                const created = await AuditPrompt.create({
                    scope: def.scope,
                    title: def.title,
                    description: def.description,
                    body: def.body,
                    sortOrder: def.sortOrder,
                });
                if (scope === "system" && !sel.systemPromptId) sel.systemPromptId = created._id;
                if (AUDIT_CHANNEL_SCOPES.includes(scope) && !sel.channelPromptIds?.[scope]) {
                    sel.channelPromptIds[scope] = created._id;
                }
            }
        }
    }

    for (const scope of AUDIT_PROMPT_SCOPES) {
        if (scope === "system") {
            if (!sel.systemPromptId) {
                const first = await AuditPrompt.findOne({ scope: "system" }).sort({ sortOrder: 1 });
                if (first) sel.systemPromptId = first._id;
            }
        } else if (!sel.channelPromptIds?.[scope]) {
            const first = await AuditPrompt.findOne({ scope }).sort({ sortOrder: 1 });
            if (first) sel.channelPromptIds[scope] = first._id;
        }
    }
    await sel.save();
    invalidateAuditPromptCache();
}

async function loadRuntimeCache() {
    if (runtimeCache && Date.now() - runtimeCache.at < CACHE_MS) {
        return runtimeCache;
    }
    await ensureAuditPromptLibrary();
    const sel = await getOrCreateSelectionDoc();
    /** @type {Record<string, string>} */
    const channels = {};
    for (const ch of AUDIT_CHANNEL_SCOPES) {
        const id = sel.channelPromptIds?.[ch];
        if (id) {
            const doc = await AuditPrompt.findById(id).lean();
            channels[ch] = doc?.body ? String(doc.body).trim() : "";
        } else {
            channels[ch] = "";
        }
    }
    let system = "";
    if (sel.systemPromptId) {
        const sysDoc = await AuditPrompt.findById(sel.systemPromptId).lean();
        system = sysDoc?.body ? String(sysDoc.body).trim() : "";
    }
    if (!system) {
        const fallback = await AuditPrompt.findOne({ scope: "system" }).sort({ sortOrder: 1 }).lean();
        system = fallback?.body ? String(fallback.body).trim() : "";
    }
    runtimeCache = { at: Date.now(), system, channels };
    return runtimeCache;
}

/**
 * @returns {Promise<string>}
 */
export async function getActiveSystemPromptBody() {
    const cache = await loadRuntimeCache();
    return cache.system;
}

/**
 * @param {string} channelScope — cross | seo | ppc | ps | em
 * @returns {Promise<string>}
 */
export async function getActiveChannelPromptBody(channelScope) {
    if (!AUDIT_CHANNEL_SCOPES.includes(channelScope)) return "";
    const cache = await loadRuntimeCache();
    return cache.channels[channelScope] || "";
}

/**
 * Admin library payload.
 */
export async function getAuditPromptLibraryForAdmin() {
    await ensureAuditPromptLibrary();
    const rows = await AuditPrompt.find({}).sort({ scope: 1, sortOrder: 1, title: 1 }).lean();
    const sel = await getOrCreateSelectionDoc();

    /** @type {Record<string, ReturnType<typeof serializePrompt>[]>} */
    const promptsByScope = {};
    for (const scope of AUDIT_PROMPT_SCOPES) {
        promptsByScope[scope] = [];
    }
    for (const row of rows) {
        const p = serializePrompt(row);
        if (p && promptsByScope[p.scope]) promptsByScope[p.scope].push(p);
    }

    const scopes = AUDIT_PROMPT_SCOPES.map((id) => ({
        id,
        ...AUDIT_SCOPE_META[id],
    }));

    return {
        scopes,
        promptsByScope,
        selection: serializeSelection(sel),
    };
}

/**
 * @param {{ scope: string, title?: string, description?: string, body: string, userId?: import('mongoose').Types.ObjectId|null }} input
 */
export async function createAuditPrompt(input) {
    await ensureAuditPromptLibrary();
    const scope = String(input.scope || "").trim();
    if (!AUDIT_PROMPT_SCOPES.includes(scope)) {
        throw new Error("Invalid scope");
    }
    const body = String(input.body || "").trim();
    if (!body) throw new Error("Prompt body cannot be empty");

    const maxOrder = await AuditPrompt.findOne({ scope }).sort({ sortOrder: -1 }).lean();
    const sortOrder = (maxOrder?.sortOrder ?? -1) + 1;

    const doc = await AuditPrompt.create({
        scope,
        title: String(input.title || "").trim() || `New ${AUDIT_SCOPE_META[scope]?.label || scope} prompt`,
        description: String(input.description || "").trim(),
        body,
        sortOrder,
        updatedByUserId: input.userId || null,
    });

    const sel = await getOrCreateSelectionDoc();
    const scopeCount = await AuditPrompt.countDocuments({ scope });
    if (scopeCount === 1) {
        if (scope === "system") sel.systemPromptId = doc._id;
        else sel.channelPromptIds[scope] = doc._id;
        await sel.save();
    }

    invalidateAuditPromptCache();
    return serializePrompt(doc);
}

/**
 * @param {string} id
 * @param {{ title?: string, description?: string, body?: string, userId?: import('mongoose').Types.ObjectId|null }} patch
 */
export async function updateAuditPrompt(id, patch) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new Error("Invalid prompt id");
    const body = patch.body != null ? String(patch.body).trim() : undefined;
    if (body !== undefined && !body) throw new Error("Prompt body cannot be empty");

    const update = {};
    if (patch.title != null) update.title = String(patch.title).trim() || "Untitled prompt";
    if (patch.description != null) update.description = String(patch.description).trim();
    if (body !== undefined) update.body = body;
    if (patch.userId) update.updatedByUserId = patch.userId;

    const doc = await AuditPrompt.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true });
    if (!doc) throw new Error("Prompt not found");
    invalidateAuditPromptCache();
    return serializePrompt(doc);
}

/**
 * @param {string} id
 */
export async function deleteAuditPrompt(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new Error("Invalid prompt id");
    const doc = await AuditPrompt.findById(id);
    if (!doc) throw new Error("Prompt not found");

    const sel = await getOrCreateSelectionDoc();
    const scope = doc.scope;
    const isSelected =
        (scope === "system" && String(sel.systemPromptId) === id) ||
        (AUDIT_CHANNEL_SCOPES.includes(scope) &&
            String(sel.channelPromptIds?.[scope]) === id);

    const remaining = await AuditPrompt.countDocuments({ scope, _id: { $ne: doc._id } });
    if (remaining === 0) {
        throw new Error("Cannot delete the last prompt in this section");
    }

    await AuditPrompt.deleteOne({ _id: doc._id });

    if (isSelected) {
        const next = await AuditPrompt.findOne({ scope }).sort({ sortOrder: 1 });
        if (scope === "system") sel.systemPromptId = next?._id || null;
        else sel.channelPromptIds[scope] = next?._id || null;
        await sel.save();
    }

    invalidateAuditPromptCache();
    return { deletedId: id, scope };
}

/**
 * @param {string} scope
 * @param {string} promptId
 */
export async function selectAuditPrompt(scope, promptId) {
    if (!AUDIT_PROMPT_SCOPES.includes(scope)) throw new Error("Invalid scope");
    if (!mongoose.Types.ObjectId.isValid(promptId)) throw new Error("Invalid prompt id");

    const doc = await AuditPrompt.findById(promptId).lean();
    if (!doc || doc.scope !== scope) {
        throw new Error("Prompt does not belong to this section");
    }

    const sel = await getOrCreateSelectionDoc();
    if (scope === "system") {
        sel.systemPromptId = doc._id;
    } else {
        sel.channelPromptIds[scope] = doc._id;
    }
    await sel.save();
    invalidateAuditPromptCache();
    return serializeSelection(sel);
}
