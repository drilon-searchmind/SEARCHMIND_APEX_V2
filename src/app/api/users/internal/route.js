import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "../../../../../lib/mongodb";
import User from "../../../../../models/User";

/**
 * GET /api/users/internal — internal (non-external), non-archived users for assignment UIs.
 * Requires an authenticated session.
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectToDatabase();
        const docs = await User.find({
            isExternal: { $ne: true },
            isArchived: { $ne: true },
        })
            .select("name image clickupId")
            .sort({ name: 1 })
            .lean();

        const users = docs.map((u) => ({
            id: String(u._id),
            name: u.name,
            image: u.image || null,
            clickupId: (u.clickupId && String(u.clickupId).trim()) || "",
        }));

        return NextResponse.json(users);
    } catch (e) {
        console.error("[users/internal GET]", e);
        return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
    }
}
