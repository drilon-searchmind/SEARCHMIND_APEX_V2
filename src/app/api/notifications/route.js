import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
    countUnreadForUser,
    listNotificationsForUser,
} from "../../../../lib/appNotificationOperations";

function sessionUserId(session) {
    const id = session?.user?.id;
    if (id) return String(id);
    return null;
}

/** GET — latest notifications + unread count (for bell and notifications page) */
export async function GET(req) {
    try {
        const session = await getServerSession(authOptions);
        const userId = sessionUserId(session);
        if (!session || !userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const { searchParams } = new URL(req.url);
        const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10) || 20, 200);
        const [notifications, unreadCount] = await Promise.all([
            listNotificationsForUser(userId, { limit }),
            countUnreadForUser(userId),
        ]);
        return NextResponse.json({ notifications, unreadCount });
    } catch (e) {
        console.error("[notifications GET]", e);
        return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 });
    }
}
