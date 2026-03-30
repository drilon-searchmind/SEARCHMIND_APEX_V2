import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createNewsPost, listAllNewsPostsForAdmin } from "../../../../../lib/newsPostOperations";

function requireAdmin(session) {
    if (!session?.user) return null;
    if (!session.user.isAdmin) return false;
    return true;
}

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        const ok = requireAdmin(session);
        if (!session || ok === null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (ok === false) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        const posts = await listAllNewsPostsForAdmin();
        return NextResponse.json({ posts });
    } catch (e) {
        console.error("[admin news GET]", e);
        return NextResponse.json({ error: "Failed to load posts" }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const session = await getServerSession(authOptions);
        const ok = requireAdmin(session);
        if (!session || ok === null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (ok === false) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        const body = await req.json();
        const { title, excerpt, content, coverImageUrl, tags, published } = body;
        if (!title || !content) {
            return NextResponse.json({ error: "title and content are required" }, { status: 400 });
        }
        const tagList = Array.isArray(tags)
            ? tags
            : String(tags || "")
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean);
        const post = await createNewsPost({
            title,
            excerpt: excerpt || "",
            content,
            coverImageUrl: coverImageUrl || "",
            tags: tagList,
            published: !!published,
            createdById: session.user.id ? String(session.user.id) : null,
        });
        return NextResponse.json({ post }, { status: 201 });
    } catch (e) {
        console.error("[admin news POST]", e);
        return NextResponse.json({ error: e.message || "Failed to create" }, { status: 500 });
    }
}
