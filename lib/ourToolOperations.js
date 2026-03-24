import connectToDatabase from "./mongodb.js";
import OurTool from "../src/models/OurTool.js";

function normalizeTags(tags) {
    if (Array.isArray(tags)) {
        return tags
            .map((t) => (typeof t === "string" ? t.trim() : ""))
            .filter(Boolean);
    }
    if (typeof tags === "string") {
        return tags
            .split(/[,，]/)
            .map((t) => t.trim())
            .filter(Boolean);
    }
    return [];
}

async function getNextOrder() {
    const last = await OurTool.findOne()
        .sort({ order: -1 })
        .select("order")
        .lean();
    return (last?.order ?? -1) + 1;
}

export async function getOurTools() {
    await connectToDatabase();
    try {
        const tools = await OurTool.find({}).sort({ order: 1, createdAt: 1 });
        return tools;
    } catch (error) {
        throw new Error(`Failed to fetch tools: ${error.message}`);
    }
}

export async function createOurTool(toolData) {
    await connectToDatabase();
    try {
        const order =
            typeof toolData.order === "number"
                ? toolData.order
                : await getNextOrder();

        const tool = new OurTool({
            title: toolData.title,
            description: toolData.description ?? "",
            category: toolData.category,
            tags: normalizeTags(toolData.tags),
            url: toolData.url ?? "",
            icon: toolData.icon || "FiGrid",
            badge: toolData.badge ?? "",
            previewImage: toolData.previewImage ?? "",
            backgroundImage: toolData.backgroundImage ?? "",
            order,
        });
        return await tool.save();
    } catch (error) {
        throw new Error(`Failed to create tool: ${error.message}`);
    }
}

export async function updateOurTool(toolId, updateData) {
    await connectToDatabase();
    try {
        const patch = { ...updateData };
        if (patch.tags !== undefined) {
            patch.tags = normalizeTags(patch.tags);
        }

        const tool = await OurTool.findByIdAndUpdate(
            toolId,
            patch,
            { new: true, runValidators: true }
        );

        if (!tool) {
            throw new Error("Tool not found");
        }
        return tool;
    } catch (error) {
        if (error.message === "Tool not found") throw error;
        throw new Error(`Failed to update tool: ${error.message}`);
    }
}

export async function deleteOurTool(toolId) {
    await connectToDatabase();
    try {
        const tool = await OurTool.findByIdAndDelete(toolId);
        if (!tool) {
            throw new Error("Tool not found");
        }
        return tool;
    } catch (error) {
        if (error.message === "Tool not found") throw error;
        throw new Error(`Failed to delete tool: ${error.message}`);
    }
}
