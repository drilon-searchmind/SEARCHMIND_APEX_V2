import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST() {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const secure = process.env.NODE_ENV === "production";
    const res = NextResponse.json({ ok: true });
    res.cookies.set("bing_wm_access_token", "", { httpOnly: true, secure, path: "/", maxAge: 0 });
    res.cookies.set("bing_wm_refresh_token", "", { httpOnly: true, secure, path: "/", maxAge: 0 });
    return res;
}
