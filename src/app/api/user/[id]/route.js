import connectToDatabase from "../../../../../lib/mongodb";
import { getUserSafeById, updateUserProfileById } from "../../../../../lib/userService";

export async function GET(_req, { params }) {
    try {
        await connectToDatabase();
        const resolvedParams = await params;
        const id = resolvedParams.id;
        if (!id) return new Response(JSON.stringify({ error: "Missing id" }), { status: 400 });

        const user = await getUserSafeById(id);
        if (!user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
        return new Response(JSON.stringify(user), { status: 200 });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message || "Server error" }), { status: 500 });
    }
}

export async function PUT(req, { params }) {
    try {
        await connectToDatabase();
        const resolvedParams = await params;
        const id = resolvedParams.id;
        if (!id) return new Response(JSON.stringify({ error: "Missing id" }), { status: 400 });

        const body = await req.json();
        // Only pass allowed fields; service already guards, but filter anyway
        const allowed = (({ name, email, image, password }) => ({ name, email, image, password }))(body || {});

        const updated = await updateUserProfileById(id, allowed);
        if (!updated) return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });

        return new Response(JSON.stringify(updated), { status: 200 });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message || "Server error" }), { status: 500 });
    }
}
