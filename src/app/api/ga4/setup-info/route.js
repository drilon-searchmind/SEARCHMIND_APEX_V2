import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getGa4ServiceAccountEmail } from "@/lib/ga4ErrorUtils";

/** Returns the service account email admins must grant GA4 Viewer access to. */
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceAccountEmail = getGa4ServiceAccountEmail();
    return NextResponse.json({
        serviceAccountEmail,
        setupSteps: [
            "Open Google Analytics → Admin → Property access management for the client's GA4 property.",
            "Click Add users and paste the service account email below.",
            "Assign the Viewer role (read-only is enough for dashboards).",
            "Save the numeric Property ID (not G-XXXX) in APEX config.",
        ],
    });
}
