/**
 * @param {number | null | undefined} amount
 * @param {string} [currencyCode]
 */
export function formatBudgetAmount(amount, currencyCode = "DKK") {
  if (amount == null || Number.isNaN(Number(amount))) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(Number(amount));
  } catch {
    return `${Number(amount).toLocaleString("en-US")} ${currencyCode}`;
  }
}
