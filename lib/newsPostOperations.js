import connectToDatabase from "./mongodb.js";
import NewsPost from "../src/models/NewsPost.js";
import mongoose from "mongoose";

function slugify(title) {
    return String(title || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 120);
}

export async function ensureUniqueSlug(baseSlug) {
    await connectToDatabase();
    const base = baseSlug || "post";
    for (let n = 0; n < 1000; n++) {
        const candidate = n === 0 ? base : `${base}-${n}`;
        const exists = await NewsPost.exists({ slug: candidate });
        if (!exists) return candidate;
    }
    throw new Error("Could not allocate unique slug");
}

export function serializeNewsPost(doc) {
    const o = doc.toObject ? doc.toObject() : doc;
    return {
        id: String(o._id),
        title: o.title,
        slug: o.slug,
        excerpt: o.excerpt || "",
        content: o.content,
        coverImageUrl: o.coverImageUrl || "",
        tags: Array.isArray(o.tags) ? o.tags : [],
        published: !!o.published,
        publishedAt: o.publishedAt,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
    };
}

export async function listPublishedNewsPosts({ limit = 50 } = {}) {
    await connectToDatabase();
    const docs = await NewsPost.find({ published: true })
        .sort({ publishedAt: -1, createdAt: -1 })
        .limit(Math.min(Number(limit) || 50, 100))
        .select("title slug excerpt coverImageUrl tags publishedAt createdAt")
        .lean();
    return docs.map((o) => ({
        id: String(o._id),
        title: o.title,
        slug: o.slug,
        excerpt: o.excerpt || "",
        coverImageUrl: o.coverImageUrl || "",
        tags: o.tags || [],
        publishedAt: o.publishedAt,
        createdAt: o.createdAt,
    }));
}

export async function getPublishedNewsBySlug(slug) {
    await connectToDatabase();
    const doc = await NewsPost.findOne({ slug, published: true }).lean();
    if (!doc) return null;
    return serializeNewsPost(doc);
}

export async function listAllNewsPostsForAdmin() {
    await connectToDatabase();
    const docs = await NewsPost.find().sort({ updatedAt: -1 }).limit(200).lean();
    return docs.map(serializeNewsPost);
}

export async function createNewsPost({ title, excerpt, content, coverImageUrl, tags, published, createdById }) {
    await connectToDatabase();
    const base = slugify(title);
    const slug = await ensureUniqueSlug(base || "news");
    const now = new Date();
    const doc = await NewsPost.create({
        title: String(title).trim(),
        slug,
        excerpt: String(excerpt || "").trim(),
        content: String(content),
        coverImageUrl: String(coverImageUrl || "").trim(),
        tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [],
        published: !!published,
        publishedAt: published ? now : null,
        createdBy:
            createdById && mongoose.Types.ObjectId.isValid(createdById) ? createdById : null,
    });
    return serializeNewsPost(doc);
}

export async function updateNewsPost(id, updates) {
    await connectToDatabase();
    if (!mongoose.Types.ObjectId.isValid(id)) throw new Error("Invalid post id");
    const allowed = {};
    if (typeof updates.title === "string") allowed.title = updates.title.trim();
    if (typeof updates.excerpt === "string") allowed.excerpt = updates.excerpt.trim();
    if (typeof updates.content === "string") allowed.content = updates.content;
    if (typeof updates.coverImageUrl === "string") allowed.coverImageUrl = updates.coverImageUrl.trim();
    if (Array.isArray(updates.tags)) allowed.tags = updates.tags.map((t) => String(t).trim()).filter(Boolean);
    if (typeof updates.published === "boolean") {
        allowed.published = updates.published;
        if (updates.published) {
            const cur = await NewsPost.findById(id).select("publishedAt").lean();
            if (cur && !cur.publishedAt) allowed.publishedAt = new Date();
        }
    }
    if (typeof updates.slug === "string" && updates.slug.trim()) {
        const s = updates.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
        const clash = await NewsPost.findOne({ slug: s, _id: { $ne: id } });
        if (clash) throw new Error("Slug already in use");
        allowed.slug = s;
    }
    const doc = await NewsPost.findByIdAndUpdate(id, { $set: allowed }, { new: true });
    if (!doc) throw new Error("Post not found");
    return serializeNewsPost(doc);
}

export async function deleteNewsPost(id) {
    await connectToDatabase();
    if (!mongoose.Types.ObjectId.isValid(id)) throw new Error("Invalid post id");
    await NewsPost.deleteOne({ _id: id });
}
