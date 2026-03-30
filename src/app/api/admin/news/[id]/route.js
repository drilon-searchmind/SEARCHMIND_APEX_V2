import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { updateNewsPost, deleteNewsPost } from "../../../../../../lib/newsPostOperations";

function requireAdmin(session) {
    if (!session?.user) return null;
    if (!session.user.isAdmin) return false;
    return true;
}

export async function PUT(req, context) {
    try {
        const session = await getServerSession(authOptions);
        const ok = requireAdmin(session);
        if (!session || ok === null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (ok === false) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        const params = await context.params;
        const id = params?.id;
        if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
        const body = await req.json();
        const tagList =
            body.tags === undefined
                ? undefined
                : Array.isArray(body.tags)
                  ? body.tags
                  : String(body.tags || "")
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean);
        const post = await updateNewsPost(id, {
            title: body.title,
            excerpt: body.excerpt,
            content: body.content,
            coverImageUrl: body.coverImageUrl,
            tags: tagList,
            published: body.published,
            slug: body.slug,
        });
        return NextResponse.json({ post });
    } catch (e) {
        console.error("[admin news PUT]", e);
        return NextResponse.json({ error: e.message || "Failed to update" }, { status: 500 });
    }
}

export async function DELETE(_, context) {
    try {
        const session = await getServerSession(authOptions);
        const ok = requireAdmin(session);
        if (!session || ok === null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (ok === false) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        const params = await context.params;
        const id = params?.id;
        if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
        await deleteNewsPost(id);
        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error("[admin news DELETE]", e);
        return NextResponse.json({ error: e.message || "Failed to delete" }, { status: 500 });
    }
}
