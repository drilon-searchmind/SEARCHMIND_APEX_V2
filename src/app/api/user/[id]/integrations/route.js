import connectToDatabase from "../../../../../../lib/mongodb";
import { updateUserIntegrations } from "../../../../../../lib/userService";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";

export async function PUT(req, { params }) {
    try {
        await connectToDatabase();
        
        // Get the authenticated user from session
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }

        const resolvedParams = await params;
        const userId = resolvedParams.id;
        
        // Ensure the user can only modify their own integrations
        if (String(userId) !== String(session.user.id)) {
            return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
        }

        const body = await req.json();
        const { slackId, clickupId } = body;

        // Validate that at least one field is provided
        if (slackId === undefined && clickupId === undefined) {
            return new Response(JSON.stringify({ error: "Missing slackId or clickupId" }), { status: 400 });
        }

        const updatedUser = await updateUserIntegrations(userId, { slackId, clickupId });
        
        return new Response(JSON.stringify({ 
            success: true, 
            slackId: updatedUser.slackId,
            clickupId: updatedUser.clickupId
        }), { status: 200 });
    } catch (err) {
        console.error("Error updating integrations:", err);
        return new Response(JSON.stringify({ error: err.message || "Server error" }), { status: 500 });
    }
}

export async function GET(req, { params }) {
    try {
        await connectToDatabase();
        
        // Get the authenticated user from session
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }

        const resolvedParams = await params;
        const userId = resolvedParams.id;
        
        // Ensure the user can only view their own integrations
        if (String(userId) !== String(session.user.id)) {
            return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
        }

        const User = (await import("../../../../../../models/User")).default;
        const user = await User.findById(userId).select("slackId clickupId").lean();
        
        if (!user) {
            return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
        }
        
        return new Response(JSON.stringify({ 
            success: true, 
            slackId: user.slackId || '',
            clickupId: user.clickupId || ''
        }), { status: 200 });
    } catch (err) {
        console.error("Error fetching integrations:", err);
        return new Response(JSON.stringify({ error: err.message || "Server error" }), { status: 500 });
    }
}