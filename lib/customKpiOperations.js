import connectToDatabase from "./mongodb.js";
import CustomKpi from "../src/models/CustomKpi.js";

async function clearReplacementForKey(customerId, metricKey, exceptKpiId = null, dashboardContext = "ecommerce") {
    if (!metricKey) return;
    const filter = {
        customer: customerId,
        replacesStandardMetricKey: metricKey,
        dashboardContext,
    };
    if (exceptKpiId) {
        filter._id = { $ne: exceptKpiId };
    }
    await CustomKpi.updateMany(filter, {
        $set: { replacesStandardMetricKey: null, updatedAt: new Date() },
    });
}

/**
 * Get all custom KPIs for a customer
 * @param {string} customerId - Customer ID
 * @param {{ dashboardContext?: 'ecommerce' | 'b2b' }} [options]
 * @returns {Promise<Array>} Array of custom KPIs
 */
export async function getCustomKpisByCustomerId(customerId, options = {}) {
    await connectToDatabase();

    try {
        const filter = { customer: customerId };
        if (options.dashboardContext === "b2b") {
            filter.dashboardContext = "b2b";
        } else if (options.dashboardContext === "ecommerce") {
            filter.$or = [
                { dashboardContext: { $exists: false } },
                { dashboardContext: "ecommerce" },
            ];
        }
        const kpis = await CustomKpi.find(filter).sort({
            createdAt: 1,
        });
        return kpis;
    } catch (error) {
        throw new Error(`Failed to fetch custom KPIs: ${error.message}`);
    }
}

/**
 * Create a new custom KPI
 * @param {string} customerId - Customer ID
 * @param {Object} kpiData - KPI data (name, parts, and optionally metricA, metricB, operator for legacy)
 * @returns {Promise<Object>} Created custom KPI
 */
export async function createCustomKpi(customerId, kpiData) {
    await connectToDatabase();

    try {
        const replacesKey = kpiData.replacesStandardMetricKey || null;
        const dashboardContext = kpiData.dashboardContext || "ecommerce";
        if (replacesKey) {
            await clearReplacementForKey(customerId, replacesKey, null, dashboardContext);
        }
        const kpi = new CustomKpi({
            customer: customerId,
            name: kpiData.name,
            parts: kpiData.parts || [],
            metricA: kpiData.metricA || "",
            metricB: kpiData.metricB || "",
            operator: kpiData.operator || "",
            replacesStandardMetricKey: replacesKey,
            dashboardContext,
        });
        const savedKpi = await kpi.save();
        return savedKpi;
    } catch (error) {
        throw new Error(`Failed to create custom KPI: ${error.message}`);
    }
}

/**
 * Update an existing custom KPI
 * @param {string} kpiId - Custom KPI ID
 * @param {Object} updateData - Data to update
 * @param {string} [customerId] - Optional customer ID to verify ownership
 * @returns {Promise<Object>} Updated custom KPI
 */
export async function updateCustomKpi(kpiId, updateData, customerId = null) {
    await connectToDatabase();

    try {
        const filter = customerId
            ? { _id: kpiId, customer: customerId }
            : { _id: kpiId };

        if (updateData.replacesStandardMetricKey) {
            const ctx =
                updateData.dashboardContext ||
                (await CustomKpi.findById(kpiId).select("dashboardContext"))?.dashboardContext ||
                "ecommerce";
            await clearReplacementForKey(
                customerId,
                updateData.replacesStandardMetricKey,
                kpiId,
                ctx
            );
        }

        const kpi = await CustomKpi.findOneAndUpdate(
            filter,
            {
                ...updateData,
                updatedAt: new Date(),
            },
            { new: true, runValidators: true }
        );

        if (!kpi) {
            throw new Error("Custom KPI not found");
        }

        return kpi;
    } catch (error) {
        throw new Error(`Failed to update custom KPI: ${error.message}`);
    }
}

/**
 * Delete a custom KPI
 * @param {string} kpiId - Custom KPI ID
 * @param {string} [customerId] - Optional customer ID to verify ownership
 * @returns {Promise<Object>} Deleted custom KPI
 */
export async function deleteCustomKpi(kpiId, customerId = null) {
    await connectToDatabase();

    try {
        const filter = customerId
            ? { _id: kpiId, customer: customerId }
            : { _id: kpiId };

        const kpi = await CustomKpi.findOneAndDelete(filter);

        if (!kpi) {
            throw new Error("Custom KPI not found");
        }

        return kpi;
    } catch (error) {
        throw new Error(`Failed to delete custom KPI: ${error.message}`);
    }
}
