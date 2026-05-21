import connectToDatabase from "@root/lib/mongodb";
import AuditPromptTemplate from "@/models/AuditPromptTemplate";
import { AUDIT_PROMPT_DEFAULTS } from "./auditPromptDefaults";
import { AUDIT_PROMPT_SLUGS } from "./auditPromptSlugs";

const CACHE_MS = 30_000;

/** @type {{ at: number, bySlug: Map<string, { slug: string, title: string, description: string, body: string }> } | null} */
let cache = null;

export function invalidateAuditPromptCache() {
    cache = null;
}

/**
 * Insert default prompts only when a slug is missing (never overwrite admin edits).
 */
export async function ensureAuditPromptDefaults() {
    await connectToDatabase();
    for (const def of AUDIT_PROMPT_DEFAULTS) {
        await AuditPromptTemplate.findOneAndUpdate(
            { slug: def.slug },
            {
                $setOnInsert: {
                    slug: def.slug,
                    title: def.title,
                    description: def.description,
                    body: def.body,
                    sortOrder: def.sortOrder,
                },
            },
            { upsert: true }
        );
    }
}

/**
 * @returns {Promise<Map<string, { slug: string, title: string, description: string, body: string }>>}
 */
export async function loadAuditPromptsBySlug() {
    if (cache && Date.now() - cache.at < CACHE_MS) {
        return cache.bySlug;
    }
    await ensureAuditPromptDefaults();
    const rows = await AuditPromptTemplate.find({ slug: { $in: AUDIT_PROMPT_SLUGS } })
        .sort({ sortOrder: 1 })
        .lean();
    const bySlug = new Map(
        rows.map((r) => [
            r.slug,
            {
                slug: r.slug,
                title: r.title,
                description: r.description || "",
                body: String(r.body || "").trim(),
            },
        ])
    );
    cache = { at: Date.now(), bySlug };
    return bySlug;
}

/**
 * @param {string} slug
 */
export async function getAuditPromptBodyBySlug(slug) {
    const map = await loadAuditPromptsBySlug();
    return map.get(slug)?.body || "";
}

/**
 * @returns {Promise<Array<object>>}
 */
export async function listAuditPromptsForAdmin() {
    await ensureAuditPromptDefaults();
    const rows = await AuditPromptTemplate.find({ slug: { $in: AUDIT_PROMPT_SLUGS } })
        .sort({ sortOrder: 1 })
        .lean();
    return rows.map((r) => ({
        slug: r.slug,
        title: r.title,
        description: r.description || "",
        body: r.body,
        sortOrder: r.sortOrder ?? 0,
        updatedAt: r.updatedAt,
        createdAt: r.createdAt,
    }));
}
