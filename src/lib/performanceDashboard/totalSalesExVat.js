import { displaysTotalSalesWithoutVatDeduction } from "@/lib/revenueVatDisplay";

/**
 * Total sales excluding VAT — aligned across Shopify, WooCommerce, and Magento daily rows.
 */
export function computeTotalSalesExVat({
    totalSales = 0,
    taxes = 0,
    grossSales = 0,
    netSales = 0,
    shippingRevenue = 0,
    customerType = "Shopify",
}) {
    const tax = Math.abs(Number(taxes) || 0);
    const total = Number(totalSales) || 0;
    const gross = Number(grossSales) || 0;
    const net = Number(netSales) || 0;
    const shipping = Number(shippingRevenue) || 0;
    const type = customerType || "Shopify";

    if (type === "Magento") {
        if (total > 0) return total;
        return Math.max(0, net + shipping);
    }

    if (type === "WooCommerce") {
        if (
            total > 0 &&
            gross > 0 &&
            tax > 0 &&
            Math.abs(total + tax + shipping - gross) <= Math.max(1, gross * 0.02)
        ) {
            return total;
        }
        if (tax > 0 && total > tax) return total - tax;
        if (tax > 0 && gross > tax) return gross - tax;
        return Math.max(0, net + shipping);
    }

    if (type === "DanDomain") {
        if (net > 0) return net + shipping;
        if (total > tax) return total - tax;
        return Math.max(0, gross - tax);
    }

    if (total > tax) return total - tax;
    if (gross > tax) return gross - tax;
    return Math.max(0, net + shipping);
}

/**
 * @param {object} periodTotals — from buildPeriodTotals / aggregateShopifyDailyRows shape
 * @param {string} [customerType]
 * @param {Record<string, unknown>} [customerSettings]
 */
export function totalSalesExVatFromPeriodTotals(
    periodTotals,
    customerType = "Shopify",
    customerSettings = {}
) {
    const totalSales = Number(periodTotals?.totalSales) || 0;
    if (displaysTotalSalesWithoutVatDeduction(customerSettings)) {
        return totalSales;
    }
    return computeTotalSalesExVat({
        totalSales,
        taxes: periodTotals?.taxes,
        grossSales: periodTotals?.grossSales,
        netSales: periodTotals?.netSalesFromStore,
        shippingRevenue: periodTotals?.shippingCharges,
        customerType,
    });
}
