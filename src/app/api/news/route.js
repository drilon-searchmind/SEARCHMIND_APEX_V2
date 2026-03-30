import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { listPublishedNewsPosts } from "../../../../lib/newsPostOperations";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const posts = await listPublishedNewsPosts({ limit: 50 });
        return NextResponse.json({ posts });
    } catch (e) {
        console.error("[news GET]", e);
        return NextResponse.json({ error: "Failed to load news" }, { status: 500 });
    }
}
