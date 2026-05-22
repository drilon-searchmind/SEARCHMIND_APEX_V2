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

/** @type {{ at: number, system: string } | null} */
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

function channelActiveArray(sel, channel) {
    const arr = sel?.channelActivePromptIds?.[channel];
    if (Array.isArray(arr) && arr.length > 0) {
        return arr.map((id) => String(id));
    }
    const legacy = sel?.channelPromptIds?.[channel];
    if (legacy) return [String(legacy)];
    return [];
}

/**
 * @param {import('mongoose').Document} sel
 */
function serializeSelection(sel) {
    const channels = {};
    for (const ch of AUDIT_CHANNEL_SCOPES) {
        channels[ch] = channelActiveArray(sel, ch);
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
    return migrateSelectionDoc(sel);
}

/**
 * Migrate legacy single channelPromptIds → channelActivePromptIds arrays.
 * @param {import('mongoose').Document} sel
 */
async function migrateSelectionDoc(sel) {
    let changed = false;
    for (const ch of AUDIT_CHANNEL_SCOPES) {
        const existing = sel.channelActivePromptIds?.[ch];
        const legacy = sel.channelPromptIds?.[ch];
        if ((!existing || existing.length === 0) && legacy) {
            if (!sel.channelActivePromptIds) sel.channelActivePromptIds = {};
            sel.channelActivePromptIds[ch] = [legacy];
            changed = true;
        }
        if (!sel.channelActivePromptIds?.[ch]) {
            if (!sel.channelActivePromptIds) sel.channelActivePromptIds = {};
            sel.channelActivePromptIds[ch] = [];
            changed = true;
        }
    }
    if (changed) {
        sel.markModified("channelActivePromptIds");
        await sel.save();
        invalidateAuditPromptCache();
    }
    return sel;
}

function addToChannelActive(sel, scope, promptId) {
    if (!AUDIT_CHANNEL_SCOPES.includes(scope)) return;
    if (!sel.channelActivePromptIds) sel.channelActivePromptIds = {};
    const arr = [...(sel.channelActivePromptIds[scope] || [])];
    const idStr = String(promptId);
    if (!arr.some((x) => String(x) === idStr)) {
        arr.push(promptId);
        sel.channelActivePromptIds[scope] = arr;
        sel.markModified("channelActivePromptIds");
    }
}

function removeFromChannelActive(sel, scope, promptId) {
    if (!AUDIT_CHANNEL_SCOPES.includes(scope)) return;
    const idStr = String(promptId);
    const arr = (sel.channelActivePromptIds?.[scope] || []).filter(
        (x) => String(x) !== idStr
    );
    sel.channelActivePromptIds[scope] = arr;
    sel.markModified("channelActivePromptIds");
}

/**
 * Ensure each scope has at least one prompt; channel scopes auto-activate first prompt.
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
            if (firstByScope.cross) addToChannelActive(sel, "cross", firstByScope.cross);
            await sel.save();
        } else {
            for (const def of AUDIT_PROMPT_SEED_DEFAULTS) {
                const created = await AuditPrompt.create({
                    scope: def.scope,
                    title: def.title,
                    description: def.description,
                    body: def.body,
                    sortOrder: def.sortOrder,
                });
                const sel = await getOrCreateSelectionDoc();
                if (def.scope === "system") sel.systemPromptId = created._id;
                else addToChannelActive(sel, def.scope, created._id);
                await sel.save();
            }
        }
    }

    let sel = await AuditPromptSelection.findOne({ configKey: CONFIG_KEY });
    if (!sel) sel = await AuditPromptSelection.create({ configKey: CONFIG_KEY });
    sel = await migrateSelectionDoc(sel);

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
                if (AUDIT_CHANNEL_SCOPES.includes(scope)) {
                    addToChannelActive(sel, scope, created._id);
                }
            }
        }
    }

    if (!sel.systemPromptId) {
        const first = await AuditPrompt.findOne({ scope: "system" }).sort({ sortOrder: 1 });
        if (first) sel.systemPromptId = first._id;
    }
    for (const ch of AUDIT_CHANNEL_SCOPES) {
        if (channelActiveArray(sel, ch).length === 0) {
            const first = await AuditPrompt.findOne({ scope: ch }).sort({ sortOrder: 1 });
            if (first) addToChannelActive(sel, ch, first._id);
        }
    }
    await sel.save();
    invalidateAuditPromptCache();
}

async function loadSystemCache() {
    if (runtimeCache && Date.now() - runtimeCache.at < CACHE_MS) {
        return runtimeCache.system;
    }
    await ensureAuditPromptLibrary();
    const sel = await getOrCreateSelectionDoc();
    let system = "";
    if (sel.systemPromptId) {
        const sysDoc = await AuditPrompt.findById(sel.systemPromptId).lean();
        system = sysDoc?.body ? String(sysDoc.body).trim() : "";
    }
    if (!system) {
        const fallback = await AuditPrompt.findOne({ scope: "system" }).sort({ sortOrder: 1 }).lean();
        system = fallback?.body ? String(fallback.body).trim() : "";
    }
    runtimeCache = { at: Date.now(), system };
    return system;
}

export async function getActiveSystemPromptBody() {
    return loadSystemCache();
}

/**
 * @param {string} channelScope
 * @returns {Promise<ReturnType<typeof serializePrompt>[]>}
 */
export async function getActiveChannelPrompts(channelScope) {
    if (!AUDIT_CHANNEL_SCOPES.includes(channelScope)) return [];
    await ensureAuditPromptLibrary();
    const sel = await getOrCreateSelectionDoc();
    const ids = channelActiveArray(sel, channelScope);
    if (ids.length === 0) return [];

    const docs = await AuditPrompt.find({ _id: { $in: ids } })
        .sort({ sortOrder: 1, title: 1 })
        .lean();
    const order = new Map(ids.map((id, i) => [id, i]));
    docs.sort(
        (a, b) =>
            (order.get(String(a._id)) ?? 999) - (order.get(String(b._id)) ?? 999)
    );
    return docs.map((d) => serializePrompt(d)).filter(Boolean);
}

/**
 * @param {string} promptId
 */
export async function getAuditPromptById(promptId) {
    if (!mongoose.Types.ObjectId.isValid(promptId)) return null;
    const doc = await AuditPrompt.findById(promptId).lean();
    return serializePrompt(doc);
}

/**
 * Run Audit modal: active channel prompts grouped by scope (no system body).
 */
export async function getActivePromptsForRunAudit() {
    await ensureAuditPromptLibrary();
    const sel = await getOrCreateSelectionDoc();

    /** @type {Record<string, ReturnType<typeof serializePrompt>[]>} */
    const activeByChannel = {};
    for (const ch of AUDIT_CHANNEL_SCOPES) {
        activeByChannel[ch] = await getActiveChannelPrompts(ch);
    }

    const groups = AUDIT_CHANNEL_SCOPES.map((id) => ({
        id,
        label: AUDIT_SCOPE_META[id]?.label || id,
        shortLabel: AUDIT_SCOPE_META[id]?.label?.split("·")[0]?.trim() || id,
        description: AUDIT_SCOPE_META[id]?.description || "",
    }));

    return { groups, activeByChannel };
}

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
    if (scope === "system" && !sel.systemPromptId) {
        sel.systemPromptId = doc._id;
        await sel.save();
    } else if (AUDIT_CHANNEL_SCOPES.includes(scope)) {
        addToChannelActive(sel, scope, doc._id);
        await sel.save();
    }

    invalidateAuditPromptCache();
    return serializePrompt(doc);
}

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

export async function deleteAuditPrompt(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new Error("Invalid prompt id");
    const doc = await AuditPrompt.findById(id);
    if (!doc) throw new Error("Prompt not found");

    const scope = doc.scope;
    const remaining = await AuditPrompt.countDocuments({ scope, _id: { $ne: doc._id } });
    if (remaining === 0) {
        throw new Error("Cannot delete the last prompt in this section");
    }

    const sel = await getOrCreateSelectionDoc();
    if (scope === "system" && String(sel.systemPromptId) === id) {
        const next = await AuditPrompt.findOne({ scope: "system" }).sort({ sortOrder: 1 });
        sel.systemPromptId = next?._id || null;
    } else if (AUDIT_CHANNEL_SCOPES.includes(scope)) {
        removeFromChannelActive(sel, scope, id);
    }

    await AuditPrompt.deleteOne({ _id: doc._id });
    await sel.save();
    invalidateAuditPromptCache();
    return { deletedId: id, scope };
}

/**
 * Set whether a prompt is active in Run Audit.
 * System: only one active (active=true selects; active=false ignored).
 * Channels: toggle membership in active list (multiple allowed).
 */
export async function setAuditPromptActive(scope, promptId, active) {
    if (!AUDIT_PROMPT_SCOPES.includes(scope)) throw new Error("Invalid scope");
    if (!mongoose.Types.ObjectId.isValid(promptId)) throw new Error("Invalid prompt id");

    const doc = await AuditPrompt.findById(promptId).lean();
    if (!doc || doc.scope !== scope) {
        throw new Error("Prompt does not belong to this section");
    }

    const sel = await getOrCreateSelectionDoc();

    if (scope === "system") {
        if (active) sel.systemPromptId = doc._id;
        /* keep current system prompt if unchecking — at least one system prompt required */
    } else {
        if (active) {
            addToChannelActive(sel, scope, doc._id);
        } else {
            removeFromChannelActive(sel, scope, doc._id);
        }
    }

    await sel.save();
    invalidateAuditPromptCache();
    return serializeSelection(sel);
}

/** @deprecated Use setAuditPromptActive(scope, promptId, true) */
export async function selectAuditPrompt(scope, promptId) {
    return setAuditPromptActive(scope, promptId, true);
}
