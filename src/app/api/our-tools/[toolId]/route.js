import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import mongoose from "mongoose";
import { updateOurTool, deleteOurTool } from "../../../../../lib/ourToolOperations";
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

function buildUpdatePayload(body) {
    const patch = {};
    if (body.title !== undefined) patch.title = String(body.title).trim();
    if (body.description !== undefined) patch.description = String(body.description);
    if (body.category !== undefined) {
        if (!OUR_TOOL_CATEGORY_VALUES.includes(body.category)) {
            return { error: "Invalid category" };
        }
        patch.category = body.category;
    }
    if (body.tags !== undefined) patch.tags = body.tags;
    if (body.url !== undefined) patch.url = String(body.url).trim();
    if (body.icon !== undefined) patch.icon = String(body.icon).trim() || "FiGrid";
    if (body.badge !== undefined) patch.badge = String(body.badge).trim();
    if (body.previewImage !== undefined)
        patch.previewImage = String(body.previewImage).trim();
    if (body.backgroundImage !== undefined)
        patch.backgroundImage = String(body.backgroundImage).trim();
    if (body.order !== undefined && typeof body.order === "number") {
        patch.order = body.order;
    }
    return { patch };
}

// PUT /api/our-tools/[toolId]
export async function PUT(request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const resolvedParams = await params;
        const { toolId } = resolvedParams;
        if (!toolId || !mongoose.Types.ObjectId.isValid(toolId)) {
            return NextResponse.json({ error: "Invalid tool id" }, { status: 400 });
        }

        const body = await request.json();
        const built = buildUpdatePayload(body);
        if (built.error) {
            return NextResponse.json({ error: built.error }, { status: 400 });
        }
        if (Object.keys(built.patch).length === 0) {
            return NextResponse.json(
                { error: "No valid fields to update" },
                { status: 400 }
            );
        }
        if (built.patch.title === "") {
            return NextResponse.json(
                { error: "Title cannot be empty" },
                { status: 400 }
            );
        }

        const tool = await updateOurTool(toolId, built.patch);
        return NextResponse.json(serializeTool(tool));
    } catch (error) {
        console.error("Error updating our tool:", error);
        if (error.message === "Tool not found") {
            return NextResponse.json({ error: "Tool not found" }, { status: 404 });
        }
        return NextResponse.json(
            { error: "Failed to update tool" },
            { status: 500 }
        );
    }
}

// DELETE /api/our-tools/[toolId]
export async function DELETE(request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const resolvedParams = await params;
        const { toolId } = resolvedParams;
        if (!toolId || !mongoose.Types.ObjectId.isValid(toolId)) {
            return NextResponse.json({ error: "Invalid tool id" }, { status: 400 });
        }

        const tool = await deleteOurTool(toolId);
        return NextResponse.json({
            message: "Tool deleted successfully",
            tool: serializeTool(tool),
        });
    } catch (error) {
        console.error("Error deleting our tool:", error);
        if (error.message === "Tool not found") {
            return NextResponse.json({ error: "Tool not found" }, { status: 404 });
        }
        return NextResponse.json(
            { error: "Failed to delete tool" },
            { status: 500 }
        );
    }
}
