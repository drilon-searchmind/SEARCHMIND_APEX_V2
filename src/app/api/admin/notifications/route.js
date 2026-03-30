import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
    createNotificationsForUsers,
    resolveRecipientIdsForAudience,
} from "../../../../../lib/appNotificationOperations";

function requireAdmin(session) {
    if (!session?.user) return null;
    if (!session.user.isAdmin) return false;
    return true;
}

function creatorId(session) {
    return session?.user?.id ? String(session.user.id) : null;
}

/** POST — send notification to users (admin only) */
export async function POST(req) {
    try {
        const session = await getServerSession(authOptions);
        const ok = requireAdmin(session);
        if (!session || ok === null) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (ok === false) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const body = await req.json();
        const { title, body: text, linkUrl, imageUrl, category, audience, recipientUserIds } = body;
        if (!title || !text) {
            return NextResponse.json({ error: "title and body are required" }, { status: 400 });
        }
        let ids = [];
        if (audience === "allInternal" || audience === "allUsers") {
            ids = await resolveRecipientIdsForAudience(audience);
        } else if (Array.isArray(recipientUserIds) && recipientUserIds.length > 0) {
            ids = recipientUserIds.map((x) => String(x));
        } else {
            return NextResponse.json(
                { error: "Provide audience (allInternal | allUsers) or recipientUserIds[]" },
                { status: 400 }
            );
        }
        const result = await createNotificationsForUsers({
            title,
            body: text,
            linkUrl,
            imageUrl,
            category,
            recipientUserIds: ids,
            createdById: creatorId(session),
        });
        return NextResponse.json(result, { status: 201 });
    } catch (e) {
        console.error("[admin notifications POST]", e);
        return NextResponse.json({ error: e.message || "Failed to send" }, { status: 500 });
    }
}
