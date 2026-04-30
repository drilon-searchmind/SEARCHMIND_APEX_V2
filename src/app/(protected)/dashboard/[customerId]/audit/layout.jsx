import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * Channel audits are internal-only (same rule as audit API).
 */
export default async function AuditSectionLayout({ children, params }) {
    const { customerId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        redirect("/login");
    }
    if (session.user.isExternal === true && session.user.isAdmin !== true) {
        redirect(`/dashboard/${customerId}/performance-dashboard`);
    }

    return children;
}
