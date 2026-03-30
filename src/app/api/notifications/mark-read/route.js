import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { markAllReadForUser } from "../../../../../lib/appNotificationOperations";

function sessionUserId(session) {
    const id = session?.user?.id;
    if (id) return String(id);
    return null;
}

/** POST — mark all notifications as read for the current user */
export async function POST() {
    try {
        const session = await getServerSession(authOptions);
        const userId = sessionUserId(session);
        if (!session || !userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        await markAllReadForUser(userId);
        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error("[notifications mark-read]", e);
        return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
    }
}
