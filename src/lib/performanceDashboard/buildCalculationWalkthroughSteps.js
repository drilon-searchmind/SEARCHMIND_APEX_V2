import { parseCalcContent, parseCalcValueLabels } from "./parseCalcContent";

function extractCalcFields(metric) {
    const { formulaLines, calcLines, noteLines } = parseCalcContent(
        metric?.popOverContent || ""
    );
    return {
        formula: formulaLines[0] || null,
        formulas: formulaLines,
        calcLines,
        inputs: parseCalcValueLabels(metric?.calcValueLabels),
        notes: noteLines,
    };
}

function buildDetailStep(phase, metric, label, key, opts = {}) {
    if (!metric) return null;
    const calc = extractCalcFields(metric);
    if (!calc.formulas.length && !calc.calcLines.length && !calc.inputs.length) {
        return null;
    }
    return {
        kind: "detail",
        key,
        phase,
        label: label || metric.label,
        value: metric.value,
        isNested: Boolean(opts.isNested),
        isGroup: Boolean(opts.isGroup),
        ...calc,
    };
}

/**
 * Build an ordered A→Z walkthrough from standard overview sections + metric cards.
 */
export function buildCalculationWalkthroughSteps(sections, metrics) {
    const byKey = new Map(metrics.map((m) => [m.key, m]));
    const seenKeys = new Set();
    const steps = [];
    const milestones = [];

    function addStep(step) {
        if (!step) return;
        if (step.key && seenKeys.has(step.key)) return;
        if (step.key) seenKeys.add(step.key);
        steps.push(step);
    }

    function walkBreakdown(items, phase) {
        for (const item of items || []) {
            const metricKey = item.metricKey || item.key;
            if (item.children?.length) {
                const metric = byKey.get(metricKey);
                addStep(
                    buildDetailStep(
                        phase,
                        metric,
                        item.label,
                        metricKey,
                        { isGroup: true }
                    )
                );
                walkBreakdown(item.children, phase);
                continue;
            }
            const metric = byKey.get(metricKey);
            if (!metric?.popOverContent) continue;
            if (item.valueType === "pct" && !metric.popOverContent) continue;
            addStep(
                buildDetailStep(
                    phase,
                    metric,
                    item.label || metric.label,
                    metricKey,
                    { isNested: Boolean(item.nested) }
                )
            );
        }
    }

    for (let i = 0; i < (sections || []).length; i++) {
        const section = sections[i];
        const primary = byKey.get(section.primaryKey);
        if (primary) {
            milestones.push({
                key: section.primaryKey,
                label: section.title,
                value: primary.value,
            });

            addStep({
                kind: "milestone",
                key: section.primaryKey,
                phase: section.title,
                phaseIndex: i + 1,
                label: section.title,
                value: primary.value,
                isFinal: i === sections.length - 1,
                ...extractCalcFields(primary),
            });
        }
        walkBreakdown(section.breakdown, section.title);
    }

    steps.forEach((s, idx) => {
        s.number = idx + 1;
    });

    return { steps, milestones };
}
