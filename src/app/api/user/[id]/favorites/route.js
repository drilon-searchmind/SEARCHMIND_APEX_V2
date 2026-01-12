import connectToDatabase from "../../../../../../lib/mongodb";
import { toggleFavoriteCustomer } from "../../../../../../lib/userService";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";

export async function POST(req, { params }) {
    try {
        await connectToDatabase();
        
        // Get the authenticated user from session
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }

        const resolvedParams = await params;
        const userId = resolvedParams.id;
        
        // Ensure the user can only modify their own favorites
        if (String(userId) !== String(session.user.id)) {
            return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
        }

        const body = await req.json();
        const { customerId } = body;

        if (!customerId) {
            return new Response(JSON.stringify({ error: "Missing customerId" }), { status: 400 });
        }

        const updatedUser = await toggleFavoriteCustomer(userId, customerId);
        
        return new Response(JSON.stringify({ 
            success: true, 
            favoritedCustomers: updatedUser.favoritedCustomers 
        }), { status: 200 });
    } catch (err) {
        console.error("Error toggling favorite:", err);
        return new Response(JSON.stringify({ error: err.message || "Server error" }), { status: 500 });
    }
}