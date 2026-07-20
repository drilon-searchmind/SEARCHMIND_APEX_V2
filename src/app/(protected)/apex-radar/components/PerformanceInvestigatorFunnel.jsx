"use client";

import "@xyflow/react/dist/style.css";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dagre from "dagre";
import { Handle, Position, ReactFlow, ReactFlowProvider, useReactFlow } from "@xyflow/react";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { MOCK_PI_FUNNEL as MOCK_FUNNEL } from "../lib/mockPerformanceInvestigatorData";

const STEM = "#171717";

/** Step edges share stroke so dashes read clearly (round caps help at thick weights). */
const EDGE_STYLE = {
    stroke: STEM,
    strokeWidth: 3.5,
    strokeDasharray: "4 12",
    strokeLinecap: "round",
    strokeLinejoin: "round",
};

/** Responsive layout params: dagre LR + card sizing for different container widths. */
function dimsFromWidth(containerWidth) {
    const w = Math.max(320, containerWidth || 1100);
    if (w < 480) {
        return {
            nodeW: 156,
            nodeH: 128,
            ranksep: 50,
            nodesep: 24,
            marginx: 12,
            marginy: 22,
            boxMinH: 110,
            labelClass: "text-xs font-medium text-neutral-400",
            valueClass: "text-xl font-bold tabular-nums leading-snug tracking-tight",
            changeClass: "text-xs font-medium tabular-nums",
            paddingClass: "px-2.5 py-2",
        };
    }
    if (w < 640) {
        return {
            nodeW: 184,
            nodeH: 138,
            ranksep: 66,
            nodesep: 30,
            marginx: 16,
            marginy: 30,
            boxMinH: 120,
            labelClass: "text-sm font-medium text-neutral-400",
            valueClass: "text-2xl font-bold tabular-nums leading-snug tracking-tight",
            changeClass: "text-sm font-medium tabular-nums",
            paddingClass: "px-3 py-2.5",
        };
    }
    if (w < 960) {
        return {
            nodeW: 216,
            nodeH: 156,
            ranksep: 88,
            nodesep: 36,
            marginx: 22,
            marginy: 34,
            boxMinH: 136,
            labelClass: "text-sm font-medium text-neutral-400",
            valueClass: "text-2xl font-bold tabular-nums leading-snug tracking-tight",
            changeClass: "text-sm font-medium tabular-nums",
            paddingClass: "px-4 py-3",
        };
    }
    return {
        nodeW: 252,
        nodeH: 178,
        ranksep: 116,
        nodesep: 46,
        marginx: 28,
        marginy: 42,
        boxMinH: 158,
        labelClass: "text-base font-medium text-neutral-400",
        valueClass: "text-3xl font-bold tabular-nums leading-snug tracking-tight",
        changeClass: "text-base font-medium tabular-nums",
        paddingClass: "px-4 py-3.5",
    };
}

function funnelChange(changePct) {
    if (changePct == null || Number.isNaN(changePct)) {
        return { change: undefined, changeType: undefined };
    }
    if (changePct === 0) return { change: undefined, changeType: undefined };
    const changeType = changePct > 0 ? "up" : "down";
    const change = Math.abs(changePct).toFixed(Number.isInteger(changePct) ? 0 : 1);
    return { change, changeType };
}

function TreeMetricBox({ label, value, changePct, layout }) {
    const { change, changeType } = funnelChange(changePct);
    return (
        <div
            style={{ minHeight: layout.boxMinH }}
            className={`flex w-full flex-col justify-between rounded-md bg-neutral-900 text-left text-white ring-1 ring-black/20 ${layout.paddingClass}`}
        >
            <div>
                <div className={layout.labelClass}>{label}</div>
                <div className={`mt-1.5 ${layout.valueClass}`}>{value}</div>
            </div>
            {change != null ? (
                <div
                    className={`${layout.changeClass} ${changeType === "up" ? "text-emerald-400" : "text-red-400"
                        } tabular-nums`}
                >
                    {changeType === "up" ? "+" : "−"}
                    {change}% vs prior
                </div>
            ) : (
                <div className={`${layout.changeClass} opacity-0 tabular-nums`} aria-hidden>
                    &nbsp;
                </div>
            )}
        </div>
    );
}

function MetricFlowNode({ data }) {
    const L = data.layout;
    const w = L.nodeW;
    return (
        <div style={{ width: w }} className="relative">
            <Handle
                type="target"
                position={Position.Left}
                id="in"
                aria-label="incoming"
                className="nodrag nopan border-0 !bg-neutral-900"
                style={{ width: 5, height: 5, left: -2, borderWidth: 0 }}
            />
            <TreeMetricBox label={data.label} value={data.value} changePct={data.changePct} layout={L} />
            <Handle
                type="source"
                position={Position.Right}
                id="out"
                aria-label="outgoing"
                className="nodrag nopan border-0 !bg-neutral-900"
                style={{ width: 5, height: 5, right: -2, borderWidth: 0 }}
            />
        </div>
    );
}

const nodeTypes = { metric: MetricFlowNode };

/** Left→right dagre layout; handles attach on left/right. */
function layoutWithDagre(nodes, edges, dims) {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({
        rankdir: "LR",
        ranker: "tight-tree",
        align: "UL",
        nodesep: dims.nodesep,
        ranksep: dims.ranksep,
        marginx: dims.marginx,
        marginy: dims.marginy,
        edgesep: Math.max(24, Math.round(dims.nodesep * 0.75)),
    });

    nodes.forEach((node) => {
        g.setNode(node.id, { width: dims.nodeW, height: dims.nodeH });
    });
    edges.forEach((e) => {
        g.setEdge(e.source, e.target);
    });

    dagre.layout(g);

    return nodes.map((node) => {
        const nd = g.node(node.id);
        return {
            ...node,
            position: { x: nd.x - dims.nodeW / 2, y: nd.y - dims.nodeH / 2 },
            width: dims.nodeW,
            height: dims.nodeH,
        };
    });
}

function withLayout(data, layout) {
    return { ...data, layout };
}

function buildGraphFromFunnel(F, dims) {
    const baseNodes = [
        {
            id: "convValue",
            type: "metric",
            position: { x: 0, y: 0 },
            data: withLayout(
                {
                    label: F.convValue.label,
                    value: F.convValue.value,
                    changePct: F.convValue.changePct,
                },
                dims
            ),
        },
        {
            id: "conversions",
            type: "metric",
            position: { x: 0, y: 0 },
            data: withLayout(
                {
                    label: F.conversions.label,
                    value: F.conversions.value,
                    changePct: F.conversions.changePct,
                },
                dims
            ),
        },
        {
            id: "aov",
            type: "metric",
            position: { x: 0, y: 0 },
            data: withLayout(
                { label: F.aov.label, value: F.aov.value, changePct: F.aov.changePct },
                dims
            ),
        },
        {
            id: "convRate",
            type: "metric",
            position: { x: 0, y: 0 },
            data: withLayout(
                {
                    label: F.convRate.label,
                    value: F.convRate.value,
                    changePct: F.convRate.changePct,
                },
                dims
            ),
        },
        {
            id: "clicks",
            type: "metric",
            position: { x: 0, y: 0 },
            data: withLayout(
                { label: F.clicks.label, value: F.clicks.value, changePct: F.clicks.changePct },
                dims
            ),
        },
        {
            id: "ctr",
            type: "metric",
            position: { x: 0, y: 0 },
            data: withLayout(
                { label: F.ctr.label, value: F.ctr.value, changePct: F.ctr.changePct },
                dims
            ),
        },
        {
            id: "cpc",
            type: "metric",
            position: { x: 0, y: 0 },
            data: withLayout(
                { label: "Avg. CPC", value: F.cpc.value, changePct: F.cpc.changePct },
                dims
            ),
        },
        {
            id: "impr",
            type: "metric",
            position: { x: 0, y: 0 },
            data: withLayout(
                { label: F.impr.label, value: F.impr.value, changePct: F.impr.changePct },
                dims
            ),
        },
        {
            id: "cost",
            type: "metric",
            position: { x: 0, y: 0 },
            data: withLayout(
                { label: F.cost.label, value: F.cost.value, changePct: F.cost.changePct },
                dims
            ),
        },
        {
            id: "freq",
            type: "metric",
            position: { x: 0, y: 0 },
            data: withLayout(
                { label: F.freq.label, value: F.freq.value, changePct: F.freq.changePct },
                dims
            ),
        },
    ];

    const baseEdges = [
        { id: "e_cv_conv", source: "convValue", target: "conversions", sourceHandle: "out", targetHandle: "in" },
        { id: "e_cv_aov", source: "convValue", target: "aov", sourceHandle: "out", targetHandle: "in" },
        {
            id: "e_conv_cr",
            source: "conversions",
            target: "convRate",
            sourceHandle: "out",
            targetHandle: "in",
        },
        {
            id: "e_conv_clk",
            source: "conversions",
            target: "clicks",
            sourceHandle: "out",
            targetHandle: "in",
        },
        { id: "e_clk_ctr", source: "clicks", target: "ctr", sourceHandle: "out", targetHandle: "in" },
        { id: "e_clk_cpc", source: "clicks", target: "cpc", sourceHandle: "out", targetHandle: "in" },
        { id: "e_clk_impr", source: "clicks", target: "impr", sourceHandle: "out", targetHandle: "in" },
        { id: "e_cpc_cost", source: "cpc", target: "cost", sourceHandle: "out", targetHandle: "in" },
        { id: "e_cpc_freq", source: "cpc", target: "freq", sourceHandle: "out", targetHandle: "in" },
    ].map((e) => ({
        ...e,
        type: "step",
        style: { ...EDGE_STYLE },
        pathOptions: { offset: 0 },
        interactionWidth: 0,
        animated: false,
    }));

    return {
        nodes: layoutWithDagre(baseNodes, baseEdges, dims),
        edges: baseEdges,
    };
}

const FIT_OPTS = { padding: 0.02, includeHiddenNodes: false, duration: 0, maxZoom: 1.65, minZoom: 0.03 };

function FunnelFlowCanvas({ funnelData }) {
    const { fitView, getViewport } = useReactFlow();
    const [zoomLock, setZoomLock] = useState(null);
    /** Measured wrapper width drives responsive dagre dims */
    const [containerWidth, setContainerWidth] = useState(1100);
    const wrapRef = useRef(null);

    const dims = useMemo(() => dimsFromWidth(containerWidth), [containerWidth]);
    const { nodes, edges } = useMemo(() => buildGraphFromFunnel(funnelData, dims), [funnelData, dims]);

    const applyFit = useCallback(() => {
        fitView(FIT_OPTS);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setZoomLock(getViewport().zoom);
            });
        });
    }, [fitView, getViewport]);

    const onInit = useCallback(() => {
        requestAnimationFrame(() => applyFit());
    }, [applyFit]);

    useEffect(() => {
        requestAnimationFrame(() => applyFit());
    }, [nodes, edges, applyFit]);

    useEffect(() => {
        const el = wrapRef.current;
        if (!el || typeof ResizeObserver === "undefined") return undefined;
        const sync = () => {
            const w = el.clientWidth;
            if (w > 0) setContainerWidth(w);
            requestAnimationFrame(() => applyFit());
        };
        sync();
        const ro = new ResizeObserver(sync);
        ro.observe(el);
        return () => ro.disconnect();
    }, [applyFit]);

    const minZ = zoomLock ?? 0.05;
    const maxZ = zoomLock ?? 2;

    return (
        <div ref={wrapRef} className="apex-radar-funnel-flow-root h-full min-h-0 w-full box-border px-4 sm:px-6">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onInit={onInit}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                zoomOnScroll={false}
                zoomOnPinch={false}
                zoomOnDoubleClick={false}
                panOnScroll={false}
                panOnDrag={false}
                preventScrolling
                disableKeyboardA11y
                autoPanOnNodeDrag={false}
                autoPanOnConnect={false}
                minZoom={minZ}
                maxZoom={maxZ}
                elevateEdgesOnSelect={false}
                defaultEdgeOptions={{
                    type: "step",
                    style: { ...EDGE_STYLE },
                    pathOptions: { offset: 0 },
                    interactionWidth: 0,
                }}
                className="!h-full !w-full"
            />
        </div>
    );
}

/**
 * Horizontal performance tree (left → right): root uses full canvas width when refitted.
 * Responsive card + dagre spacing from container width; `fitView` runs on resize.
 */
export default function PerformanceInvestigatorFunnel({ funnel = null, loading = false, compareHint = null }) {
    const funnelData = funnel != null ? funnel : MOCK_FUNNEL;

    if (loading && funnel == null) {
        return (
            <div className="apex-radar-pi-loader-panel">
                <CobaltLoader variant="block" title="Loading funnel" />
            </div>
        );
    }

    return (
        <div className="apex-radar-funnel-panel">
            <section className="px-4 sm:px-6">
                <div>
                    <h3 className="apex-radar-section__title">Performance funnel</h3>
                    <p className="apex-radar-section__subtitle mt-1">
                        {compareHint ? compareHint : ""}
                    </p>
                </div>

                <div className="apex-radar-funnel-flow [&_.react-flow__attribution]:pointer-events-none [&_.react-flow__attribution]:hidden [&_.react-flow]:box-border [&_.react-flow]:h-full [&_.react-flow]:w-full">
                    <ReactFlowProvider>
                        <FunnelFlowCanvas funnelData={funnelData} />
                    </ReactFlowProvider>
                </div>
            </section>
        </div>
    );
}
