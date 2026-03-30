import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getOurTools, createOurTool } from "../../../../lib/ourToolOperations";
import { OUR_TOOL_CATEGORY_VALUES } from "@/models/OurTool";

function serializeTool(doc) {
    const obj = doc.toObject ? doc.toObject() : doc;
    return {
        id: obj._id?.toString() || obj.id,
        title: obj.title,
        description: obj.description ?? "",
        category: obj.category,
        tags: Array.isArray(obj.tags) ? obj.tags : [],
        url: obj.url ?? "",
        icon: obj.icon ?? "FiGrid",
        badge: obj.badge ?? "",
        previewImage: obj.previewImage ?? "",
        backgroundImage: obj.backgroundImage ?? "",
        order: typeof obj.order === "number" ? obj.order : 0,
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt,
    };
}

// GET /api/our-tools
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const tools = await getOurTools();
        return NextResponse.json(tools.map(serializeTool));
    } catch (error) {
        console.error("Error fetching our tools:", error);
        return NextResponse.json(
            { error: "Failed to fetch tools" },
            { status: 500 }
        );
    }
}

// POST /api/our-tools
export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const title = (body.title || "").trim();
        if (!title) {
            return NextResponse.json(
                { error: "Title is required" },
                { status: 400 }
            );
        }

        const category = body.category;
        if (!category || !OUR_TOOL_CATEGORY_VALUES.includes(category)) {
            return NextResponse.json(
                { error: "Valid category is required" },
                { status: 400 }
            );
        }

        const tool = await createOurTool({
            title,
            description: body.description ?? "",
            category,
            tags: Array.isArray(body.tags) ? body.tags : [],
            url: body.url ?? "",
            icon: body.icon || "FiGrid",
            badge: body.badge ?? "",
            previewImage: body.previewImage ?? "",
            backgroundImage: body.backgroundImage ?? "",
            order:
                typeof body.order === "number" && !Number.isNaN(body.order)
                    ? body.order
                    : undefined,
        });

        return NextResponse.json(serializeTool(tool), { status: 201 });
    } catch (error) {
        console.error("Error creating our tool:", error);
        if (
            error?.message?.includes("Unknown or invalid tags") ||
            error?.message?.includes("Unknown or invalid")
        ) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json(
            { error: "Failed to create tool" },
            { status: 500 }
        );
    }
}
