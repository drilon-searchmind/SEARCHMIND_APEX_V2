import connectToDatabase from "./mongodb.js";
import ContentTag from "../src/models/ContentTag.js";

const DEFAULT_COLOR = "#64748b";

/** Slug for tag keys — stable, avoids "Shopify" vs "shopify" */
export function slugifyTagLabel(input) {
    return String(input || "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80);
}

const SEED_TAGS = [
    { slug: "reporting", label: "Reporting", color: "#0369a1", scopes: ["tools", "news"] },
    { slug: "analytics", label: "Analytics", color: "#0f766e", scopes: ["tools", "news"] },
    { slug: "seo", label: "SEO", color: "#15803d", scopes: ["tools", "news"] },
    { slug: "ppc", label: "PPC", color: "#b45309", scopes: ["tools", "news"] },
    { slug: "productivity", label: "Productivity", color: "#7c3aed", scopes: ["tools", "news"] },
    { slug: "design", label: "Design", color: "#be123c", scopes: ["tools", "news"] },
    { slug: "collaboration", label: "Collaboration", color: "#4338ca", scopes: ["tools", "news"] },
    { slug: "beta", label: "Beta", color: "#ca8a04", scopes: ["tools", "news"] },
    { slug: "internal", label: "Internal", color: "#475569", scopes: ["news"] },
    { slug: "client-facing", label: "Client-facing", color: "#059669", scopes: ["news"] },
    { slug: "roadmap", label: "Roadmap", color: "#2563eb", scopes: ["news"] },
    { slug: "tip", label: "Tip", color: "#db2777", scopes: ["news"] },
];

export function serializeContentTag(doc) {
    const o = doc.toObject ? doc.toObject() : doc;
    return {
        id: String(o._id),
        slug: o.slug,
        label: o.label,
        color: o.color || DEFAULT_COLOR,
        scopes: Array.isArray(o.scopes) ? o.scopes : ["tools", "news"],
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
    };
}

export async function ensureContentTagsSeeded() {
    await connectToDatabase();
    const n = await ContentTag.countDocuments();
    if (n > 0) return;
    try {
        await ContentTag.insertMany(
            SEED_TAGS.map((t) => ({
                slug: t.slug,
                label: t.label,
                color: t.color,
                scopes: t.scopes,
            }))
        );
    } catch (e) {
        if (e?.code !== 11000) throw e;
    }
}

/**
 * Tags visible for a scope (tools | news).
 */
export async function listContentTagsForScope(scope) {
    await connectToDatabase();
    await ensureContentTagsSeeded();
    const q = scope ? { scopes: scope } : {};
    const docs = await ContentTag.find(q).sort({ label: 1 }).lean();
    return docs.map((d) => serializeContentTag(d));
}

export async function createContentTag({ label, color, scopes }) {
    await connectToDatabase();
    const trimmed = String(label || "").trim();
    if (!trimmed) throw new Error("Label is required");
    const slug = slugifyTagLabel(trimmed);
    if (!slug) throw new Error("Invalid tag label");
    const exists = await ContentTag.findOne({ slug });
    if (exists) throw new Error("A tag with this name already exists");
    let hex = String(color || DEFAULT_COLOR).trim();
    if (!/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/.test(hex)) hex = DEFAULT_COLOR;
    const scopeList =
        Array.isArray(scopes) && scopes.length
            ? scopes.filter((s) => s === "tools" || s === "news")
            : ["tools", "news"];
    const uniqueScopes = [...new Set(scopeList.length ? scopeList : ["tools", "news"])];
    const doc = await ContentTag.create({
        slug,
        label: trimmed,
        color: hex,
        scopes: uniqueScopes,
    });
    return serializeContentTag(doc);
}

/**
 * Normalize + validate tag slugs for persistence. Throws if any unknown slug.
 * @param {string[]|string} input - slugs or comma-string
 * @param {"tools"|"news"} scope
 */
export async function normalizeTagSlugsForScope(input, scope) {
    await connectToDatabase();
    await ensureContentTagsSeeded();
    let arr = [];
    if (Array.isArray(input)) {
        arr = input.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
    } else if (typeof input === "string") {
        arr = input
            .split(/[,，]/)
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean);
    }
    arr = [...new Set(arr)];
    if (arr.length === 0) return [];
    const docs = await ContentTag.find({
        slug: { $in: arr },
        scopes: scope,
    })
        .select("slug")
        .lean();
    const have = new Set(docs.map((d) => d.slug));
    const missing = arr.filter((s) => !have.has(s));
    if (missing.length) {
        throw new Error(`Unknown or invalid tags for ${scope}: ${missing.join(", ")}`);
    }
    return arr;
}
