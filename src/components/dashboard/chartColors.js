// Chart color tokens — reads Apex design tokens when available.

export function getChartColors() {
  if (typeof window === "undefined") return {};
  const root =
    document.querySelector(".apex-perf") ||
    document.querySelector(".cobalt-perf") ||
    document.documentElement;
  const styles = getComputedStyle(root);
  return {
    primary: styles.getPropertyValue("--color-ink").trim() || styles.getPropertyValue("--apex-ink").trim() || "#131313",
    primaryLighter: styles.getPropertyValue("--color-ink-2").trim() || "#3a3a3a",
    secondary: styles.getPropertyValue("--color-muted").trim() || "#6b6b6b",
    lime: styles.getPropertyValue("--apex-lime").trim() || styles.getPropertyValue("--color-lime").trim() || "#C6ED62",
    natural: styles.getPropertyValue("--color-paper-2").trim() || "#f4f3f1",
    lightGreen: styles.getPropertyValue("--apex-lime").trim() || "#C6ED62",
    green: styles.getPropertyValue("--color-ink").trim() || "#131313",
    black: styles.getPropertyValue("--color-ink").trim() || "#131313",
  };
}
