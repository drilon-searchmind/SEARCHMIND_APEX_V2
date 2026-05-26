"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    FiX,
    FiSearch,
    FiSend,
    FiPlus,
    FiMessageSquare,
    FiDownload,
    FiTrash2,
} from "react-icons/fi";
import { LuBrainCircuit } from "react-icons/lu";
import { useSession } from "next-auth/react";
import Spinner from "@/components/ui/Spinner";
import ReactMarkdown from "react-markdown";
import { isMongoObjectIdString } from "@/lib/channelAuditReport";

/**
 * @param {string} content
 * @returns {string | null}
 */
function extractHtmlFromMessage(content) {
    const match = String(content || "").match(/```html\s*([\s\S]*?)```/i);
    return match?.[1]?.trim() || null;
}

function downloadHtmlFile(html, filename = "audit-deliverable.html") {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * @param {object} finding
 * @param {(severity: string) => string} formatSeverity
 */
function FindingContextPanel({ finding, formatSeverity }) {
    if (!finding || typeof finding !== "object") return null;

    const title = finding.title || "Untitled finding";
    const severity = formatSeverity(finding.severity);
    const context = finding.rationale || finding.evidence || "";
    const recommendation = finding.recommendation || finding.recommendedAction || "";
    const impact = finding.impact || "";
    const businessCase = finding.business_case || "";

    return (
        <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-4 mb-4 text-sm text-gray-800">
            <p className="text-[0.65rem] font-bold uppercase tracking-wide text-purple-700 mb-2">
                Finding context
            </p>
            <h4 className="font-semibold text-gray-900 mb-1">{title}</h4>
            <p className="text-xs text-purple-700 mb-3">Severity: {severity}</p>
            {context ? (
                <p className="text-xs leading-relaxed text-gray-700 mb-2">
                    <span className="font-semibold">Context: </span>
                    {context}
                </p>
            ) : null}
            {impact ? (
                <p className="text-xs leading-relaxed text-gray-700 mb-2">
                    <span className="font-semibold">Impact: </span>
                    {impact}
                </p>
            ) : null}
            {recommendation ? (
                <p className="text-xs leading-relaxed text-gray-700 mb-2">
                    <span className="font-semibold">Recommendation: </span>
                    {recommendation}
                </p>
            ) : null}
            {businessCase ? (
                <p className="text-xs leading-relaxed text-gray-700">
                    <span className="font-semibold">Business case: </span>
                    {businessCase}
                </p>
            ) : null}
            <p className="mt-3 text-xs text-gray-500">
                Ask a question below — nothing is sent to AI until you submit.
            </p>
        </div>
    );
}

const AuditFollowUpModal = ({
    onClose,
    customerId,
    auditId,
    dateRange = { startDate: "", endDate: "" },
    comparisonDateRange = null,
    auditReportSnapshot = {},
    customerName = "",
    initialFinding = null,
    formatSeverity = (s) => s || "—",
}) => {
    const { data: session, status: sessionStatus } = useSession();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedChat, setSelectedChat] = useState(null);
    const [message, setMessage] = useState("");
    const [chatHistory, setChatHistory] = useState([]);
    const [messages, setMessages] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [deletingChatId, setDeletingChatId] = useState(null);
    const [sending, setSending] = useState(false);
    const [creatingFindingChat, setCreatingFindingChat] = useState(() => Boolean(initialFinding));
    const [error, setError] = useState(null);

    const messagesEndRef = useRef(null);
    const skipChatMessagesFetchRef = useRef(false);
    const ephemeralChatIdRef = useRef(null);
    const hasCompletedAiRef = useRef(false);
    const abortControllerRef = useRef(null);
    const findingInitRunIdRef = useRef(0);
    const findingOpenedKeyRef = useRef(null);
    const createChatRef = useRef(null);

    /** Stable key so we only auto-create one chat per finding per modal open */
    const findingOpenKey = initialFinding
        ? `${String(initialFinding.title || "").trim()}|${String(
              initialFinding.evidence || initialFinding.rationale || ""
          ).slice(0, 240)}`
        : null;

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, sending]);

    const purgeEphemeralChat = useCallback(async () => {
        const id = ephemeralChatIdRef.current;
        if (!id || hasCompletedAiRef.current) return;

        abortControllerRef.current?.abort();
        abortControllerRef.current = null;

        try {
            await fetch(`/api/audit-followup/${id}?purge=true`, { method: "DELETE" });
            setChatHistory((prev) => prev.filter((c) => String(c._id) !== String(id)));
            if (String(selectedChat?._id) === String(id)) {
                setSelectedChat(null);
                setMessages([]);
            }
        } catch (err) {
            console.error("Failed to purge incomplete follow-up chat:", err);
        } finally {
            ephemeralChatIdRef.current = null;
        }
    }, [selectedChat?._id]);

    const handleCloseModal = useCallback(async () => {
        findingOpenedKeyRef.current = null;
        await purgeEphemeralChat();
        onClose();
    }, [onClose, purgeEphemeralChat]);

    const fetchChatHistory = useCallback(async ({ silent = false } = {}) => {
        if (!customerId || !auditId) return;
        try {
            if (!silent) {
                setHistoryLoading(true);
                setError(null);
            }
            const q = new URLSearchParams({
                customerId: String(customerId),
                auditId: String(auditId),
            });
            const res = await fetch(`/api/audit-followup?${q}`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to fetch chat history");
            setChatHistory(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
            if (!silent) setError(err.message);
        } finally {
            setHistoryLoading(false);
        }
    }, [customerId, auditId]);

    useEffect(() => {
        if (customerId && auditId && session?.user?.id) {
            fetchChatHistory({ silent: Boolean(initialFinding) });
        }
    }, [customerId, auditId, session?.user?.id, initialFinding, fetchChatHistory]);

    useEffect(() => {
        if (!selectedChat?._id || skipChatMessagesFetchRef.current) return;
        (async () => {
            try {
                const res = await fetch(`/api/audit-followup/${selectedChat._id}`);
                const chat = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(chat.error || "Failed to fetch chat");
                setMessages(chat.messages || []);
                hasCompletedAiRef.current = (chat.messages || []).some((m) => m.type === "ai");
            } catch (err) {
                console.error(err);
                setError(err.message);
            }
        })();
    }, [selectedChat?._id]);

    const openingFindingChat =
        Boolean(initialFinding) &&
        (sessionStatus === "loading" || creatingFindingChat);

    const filteredChats = chatHistory.filter(
        (chat) =>
            chat.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            chat.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const purgeChatById = useCallback(async (chatId) => {
        if (!chatId) return;
        try {
            await fetch(`/api/audit-followup/${chatId}?purge=true`, { method: "DELETE" });
            setChatHistory((prev) => prev.filter((c) => String(c._id) !== String(chatId)));
        } catch (err) {
            console.error("Failed to purge follow-up chat:", err);
        }
    }, []);

    const createChat = useCallback(
        async ({ findingContext, title: customTitle, addToHistory = true } = {}) => {
            if (!customerId || !auditId || !session?.user?.id) {
                throw new Error("Missing session or audit context");
            }
            const defaultTitle = `Audit follow-up — ${dateRange.startDate} to ${dateRange.endDate}`;
            const payload = {
                customerId,
                auditId,
                title: customTitle || defaultTitle,
                dateRange,
                comparisonDateRange,
                customerName,
                findingContext: findingContext || undefined,
            };
            if (!isMongoObjectIdString(auditId)) {
                payload.auditReportSnapshot = auditReportSnapshot;
            }

            const res = await fetch("/api/audit-followup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const newChat = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(newChat.error || "Failed to create chat");
            if (addToHistory) {
                setChatHistory((prev) => [newChat, ...prev]);
            }
            return newChat;
        },
        [
            customerId,
            auditId,
            session?.user?.id,
            dateRange,
            comparisonDateRange,
            auditReportSnapshot,
            customerName,
        ]
    );

    createChatRef.current = createChat;

    const postChatMessage = useCallback(async (chatId, userMessage, { signal } = {}) => {
        const res = await fetch(`/api/audit-followup/${chatId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: userMessage }),
            signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to send message");
        if (Array.isArray(data.messages) && data.messages.length > 0) {
            return { messages: data.messages };
        }
        return {
            messages: [
                {
                    type: data.type || "ai",
                    content: data.content,
                    timestamp: data.timestamp,
                },
            ],
        };
    }, []);

    useEffect(() => {
        if (!initialFinding || !findingOpenKey) {
            findingOpenedKeyRef.current = null;
            return;
        }

        if (sessionStatus === "loading") return;

        if (!session?.user?.id) {
            setCreatingFindingChat(false);
            setError("Sign in to use audit follow-up.");
            return;
        }

        if (findingOpenedKeyRef.current === findingOpenKey) return;

        const runId = ++findingInitRunIdRef.current;
        let cancelled = false;
        const create = createChatRef.current;
        if (!create) return;

        (async () => {
            setCreatingFindingChat(true);
            setError(null);
            skipChatMessagesFetchRef.current = true;
            try {
                const title = `Finding: ${initialFinding.title || "Untitled"}`;
                const chat = await create({
                    findingContext: initialFinding,
                    title,
                    addToHistory: false,
                });

                const stale = cancelled || runId !== findingInitRunIdRef.current;
                if (stale) {
                    await purgeChatById(chat._id);
                    return;
                }

                findingOpenedKeyRef.current = findingOpenKey;
                ephemeralChatIdRef.current = chat._id;
                hasCompletedAiRef.current = false;
                setChatHistory((prev) => {
                    const id = String(chat._id);
                    if (prev.some((c) => String(c._id) === id)) return prev;
                    return [chat, ...prev];
                });
                setSelectedChat(chat);
                setMessages([]);
            } catch (err) {
                if (cancelled || runId !== findingInitRunIdRef.current) return;
                console.error(err);
                setError(err?.message || "Failed to open finding chat");
            } finally {
                skipChatMessagesFetchRef.current = false;
                if (runId === findingInitRunIdRef.current) {
                    setCreatingFindingChat(false);
                }
            }
        })();

        return () => {
            cancelled = true;
            setCreatingFindingChat(false);
        };
    }, [
        initialFinding,
        findingOpenKey,
        sessionStatus,
        session?.user?.id,
        purgeChatById,
    ]);

    const handleNewChat = async () => {
        if (!customerId || !auditId || !session?.user?.id) return;
        ephemeralChatIdRef.current = null;
        hasCompletedAiRef.current = false;
        try {
            setHistoryLoading(true);
            setError(null);
            const newChat = await createChat();
            setSelectedChat(newChat);
            setMessages([]);
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleSelectChat = (chat) => {
        if (String(chat._id) !== String(ephemeralChatIdRef.current)) {
            ephemeralChatIdRef.current = null;
        }
        setSelectedChat(chat);
    };

    const handleDeleteChat = async (chat, event) => {
        event?.stopPropagation?.();
        const id = chat?._id;
        if (!id || deletingChatId) return;

        const label = (chat.title || "this chat").trim();
        if (
            typeof window !== "undefined" &&
            !window.confirm(`Delete "${label}"? This cannot be undone.`)
        ) {
            return;
        }

        setDeletingChatId(String(id));
        setError(null);
        try {
            const res = await fetch(`/api/audit-followup/${id}?purge=true`, {
                method: "DELETE",
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to delete chat");

            setChatHistory((prev) => prev.filter((c) => String(c._id) !== String(id)));
            if (String(selectedChat?._id) === String(id)) {
                setSelectedChat(null);
                setMessages([]);
            }
            if (String(ephemeralChatIdRef.current) === String(id)) {
                ephemeralChatIdRef.current = null;
                hasCompletedAiRef.current = true;
            }
        } catch (err) {
            console.error(err);
            setError(err?.message || "Failed to delete chat");
        } finally {
            setDeletingChatId(null);
        }
    };

    const sendUserMessage = useCallback(
        async (chat, userMessage) => {
            const tempUserMsg = {
                _id: `temp-${Date.now()}`,
                type: "user",
                content: userMessage,
                timestamp: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, tempUserMsg]);

            const controller = new AbortController();
            abortControllerRef.current = controller;

            try {
                const { messages: newMessages } = await postChatMessage(chat._id, userMessage, {
                    signal: controller.signal,
                });
                hasCompletedAiRef.current = true;
                ephemeralChatIdRef.current = null;
                setMessages((prev) => [
                    ...prev.filter((m) => m._id !== tempUserMsg._id),
                    tempUserMsg,
                    ...newMessages.map((m, i) => ({
                        _id: m._id || `msg-${Date.now()}-${i}`,
                        type: m.type,
                        content: m.content,
                        timestamp: m.timestamp || new Date().toISOString(),
                    })),
                ]);
                fetchChatHistory({ silent: true });
            } catch (err) {
                if (err?.name === "AbortError") {
                    setMessages((prev) => prev.filter((m) => m._id !== tempUserMsg._id));
                    return;
                }
                setMessages((prev) => prev.filter((m) => m._id !== tempUserMsg._id));
                throw err;
            } finally {
                if (abortControllerRef.current === controller) {
                    abortControllerRef.current = null;
                }
            }
        },
        [postChatMessage, fetchChatHistory]
    );

    const handleSendMessage = async () => {
        if (!message.trim() || !selectedChat || sending) return;

        const userMessage = message.trim();
        setMessage("");
        setSending(true);
        setError(null);

        try {
            await sendUserMessage(selectedChat, userMessage);
        } catch (err) {
            if (err?.name !== "AbortError") {
                console.error(err);
                setError(err.message);
            }
        } finally {
            setSending(false);
        }
    };

    const activeFindingContext = selectedChat?.findingContext || initialFinding;
    const showFindingPanel = Boolean(activeFindingContext) && messages.length === 0 && !sending;

    return (
        <div
            id="AuditFollowUpModal"
            className="fixed inset-0 z-50 flex items-center justify-center glassmorphism2"
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-followup-title"
        >
            <div className="relative flex h-[85vh] w-full max-w-6xl overflow-hidden rounded-xl border border-gray-200 bg-white">
                <button
                    type="button"
                    onClick={handleCloseModal}
                    className="absolute top-4 right-4 z-10 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Close modal"
                >
                    <FiX className="text-2xl" />
                </button>

                <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50">
                    <div className="p-4 border-b border-gray-200 bg-white">
                        <div className="flex items-center justify-between mb-3">
                            <h3
                                id="audit-followup-title"
                                className="text-sm font-semibold text-gray-900 pr-8"
                            >
                                Audit follow-up chats
                            </h3>
                            <button
                                type="button"
                                onClick={handleNewChat}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                title="New chat"
                            >
                                <FiPlus className="text-lg text-[var(--color-primary-searchmind)]" />
                            </button>
                        </div>
                        <div className="relative">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                            <input
                                type="text"
                                placeholder="Search chats..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)] focus:ring-opacity-20 bg-white"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {historyLoading ? (
                            <div className="flex items-center justify-center p-8">
                                <Spinner />
                            </div>
                        ) : filteredChats.length === 0 ? (
                            <div className="p-4 text-center text-sm text-gray-400">
                                {searchQuery ? "No chats found" : "No chats yet. Click + to start."}
                            </div>
                        ) : (
                            filteredChats.map((chat) => {
                                const isSelected = selectedChat?._id === chat._id;
                                const isDeleting = String(deletingChatId) === String(chat._id);
                                return (
                                    <div
                                        key={chat._id}
                                        onClick={() => !isDeleting && handleSelectChat(chat)}
                                        className={`group relative p-4 border-b border-gray-200 cursor-pointer transition-colors hover:bg-white ${
                                            isSelected
                                                ? "bg-white border-l-4 border-l-[var(--color-primary-searchmind)]"
                                                : ""
                                        } ${isDeleting ? "opacity-60 pointer-events-none" : ""}`}
                                    >
                                        <div className="flex items-start gap-3 pr-8">
                                            <FiMessageSquare className="mt-1 text-[var(--color-primary-searchmind)] shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-medium text-gray-900 truncate mb-1">
                                                    {chat.title}
                                                </h4>
                                                <p className="text-xs text-gray-500 truncate mb-1">
                                                    {chat.lastMessage || "New chat"}
                                                </p>
                                                <p className="text-xs text-gray-400">
                                                    {new Date(chat.updatedAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => handleDeleteChat(chat, e)}
                                            disabled={Boolean(deletingChatId)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-40"
                                            title="Delete chat"
                                            aria-label={`Delete ${chat.title || "chat"}`}
                                        >
                                            {isDeleting ? (
                                                <Spinner size={14} color="#dc2626" />
                                            ) : (
                                                <FiTrash2 className="h-4 w-4" />
                                            )}
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="flex-1 flex flex-col min-w-0">
                    {openingFindingChat ? (
                        <div className="flex-1 flex items-center justify-center">
                            <Spinner />
                        </div>
                    ) : !selectedChat ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center max-w-sm px-6">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-50 mb-4">
                                    <LuBrainCircuit className="text-2xl text-purple-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                    Discuss this audit
                                </h3>
                                <p className="text-sm text-gray-500 mb-4">
                                    Ask follow-up questions, drill into findings, or request deliverables
                                    like an HTML summary or action plan.
                                </p>
                                <button
                                    type="button"
                                    onClick={handleNewChat}
                                    className="px-4 py-2 bg-[var(--color-primary-searchmind)] text-white rounded-lg text-sm hover:opacity-90 transition-opacity"
                                >
                                    New chat
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="p-4 border-b border-gray-200 bg-white pr-14">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                    <h2 className="text-base font-semibold text-gray-900 truncate min-w-0">
                                        {selectedChat.title}
                                    </h2>
                                    <button
                                        type="button"
                                        onClick={(e) => handleDeleteChat(selectedChat, e)}
                                        disabled={Boolean(deletingChatId)}
                                        className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                                        title="Delete this chat"
                                    >
                                        {String(deletingChatId) === String(selectedChat._id) ? (
                                            <Spinner size={14} color="#dc2626" />
                                        ) : (
                                            <FiTrash2 className="h-3.5 w-3.5" />
                                        )}
                                        Delete
                                    </button>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                    <span className="px-2 py-1 bg-purple-50 text-purple-600 rounded">
                                        Period: {selectedChat.dateRange?.startDate} →{" "}
                                        {selectedChat.dateRange?.endDate}
                                    </span>
                                    {selectedChat.comparisonDateRange?.startDate ? (
                                        <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded">
                                            Compare: {selectedChat.comparisonDateRange.startDate} →{" "}
                                            {selectedChat.comparisonDateRange.endDate}
                                        </span>
                                    ) : null}
                                </div>
                                {error ? (
                                    <p className="mt-2 text-xs text-red-600" role="alert">
                                        {error}
                                    </p>
                                ) : null}
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {showFindingPanel ? (
                                    <FindingContextPanel
                                        finding={activeFindingContext}
                                        formatSeverity={formatSeverity}
                                    />
                                ) : null}
                                {messages.length === 0 && !showFindingPanel ? (
                                    <div className="flex items-center justify-center h-full min-h-[8rem]">
                                        <p className="text-sm text-gray-400 text-center max-w-md">
                                            Ask about priorities, channel trade-offs, request more
                                            data (e.g. &quot;hent mere Search Console data&quot;), or
                                            say &quot;Create a client-ready HTML summary of the top 5
                                            actions.&quot;
                                        </p>
                                    </div>
                                ) : (
                                    messages.map((msg, idx) => {
                                        if (msg.type === "data_fetch") {
                                            return (
                                                <div
                                                    key={msg._id || idx}
                                                    className="flex justify-center"
                                                >
                                                    <div className="max-w-[90%] rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5 text-xs text-teal-900 text-center">
                                                        <span className="font-semibold">
                                                            Data loaded
                                                        </span>
                                                        <span className="mx-1">·</span>
                                                        {msg.content}
                                                    </div>
                                                </div>
                                            );
                                        }

                                        const htmlBlock =
                                            msg.type === "ai"
                                                ? extractHtmlFromMessage(msg.content)
                                                : null;
                                        return (
                                            <div
                                                key={msg._id || idx}
                                                className={`flex ${
                                                    msg.type === "user"
                                                        ? "justify-end"
                                                        : "justify-start"
                                                }`}
                                            >
                                                <div
                                                    className={`max-w-[75%] ${
                                                        msg.type === "user" ? "order-2" : "order-1"
                                                    }`}
                                                >
                                                    <div
                                                        className={`rounded-lg px-4 py-3 ${
                                                            msg.type === "user"
                                                                ? "bg-[var(--color-primary-searchmind)] text-white"
                                                                : "bg-gray-100 text-gray-900"
                                                        }`}
                                                    >
                                                        {msg.type === "ai" ? (
                                                            <ReactMarkdown
                                                                components={{
                                                                    h1: ({ ...props }) => (
                                                                        <h1
                                                                            className="text-lg font-bold mb-2 text-gray-900"
                                                                            {...props}
                                                                        />
                                                                    ),
                                                                    h2: ({ ...props }) => (
                                                                        <h2
                                                                            className="text-base font-bold mb-2 text-gray-900"
                                                                            {...props}
                                                                        />
                                                                    ),
                                                                    p: ({ ...props }) => (
                                                                        <p
                                                                            className="mb-2 last:mb-0 text-gray-800 text-sm"
                                                                            {...props}
                                                                        />
                                                                    ),
                                                                    ul: ({ ...props }) => (
                                                                        <ul
                                                                            className="list-disc list-inside mb-2 text-sm space-y-1"
                                                                            {...props}
                                                                        />
                                                                    ),
                                                                    code: ({ inline, ...props }) =>
                                                                        inline ? (
                                                                            <code
                                                                                className="bg-gray-200 px-1 py-0.5 rounded text-xs font-mono"
                                                                                {...props}
                                                                            />
                                                                        ) : (
                                                                            <code
                                                                                className="block bg-gray-200 p-2 rounded text-xs font-mono mb-2 overflow-x-auto"
                                                                                {...props}
                                                                            />
                                                                        ),
                                                                }}
                                                            >
                                                                {msg.content}
                                                            </ReactMarkdown>
                                                        ) : (
                                                            <p className="text-sm whitespace-pre-wrap">
                                                                {msg.content}
                                                            </p>
                                                        )}
                                                    </div>
                                                    {htmlBlock ? (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                downloadHtmlFile(
                                                                    htmlBlock,
                                                                    `audit-${auditId}-deliverable.html`
                                                                )
                                                            }
                                                            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary-searchmind)] hover:underline"
                                                        >
                                                            <FiDownload className="h-3.5 w-3.5" />
                                                            Download HTML
                                                        </button>
                                                    ) : null}
                                                    <p
                                                        className={`text-xs text-gray-400 mt-1 ${
                                                            msg.type === "user"
                                                                ? "text-right"
                                                                : "text-left"
                                                        }`}
                                                    >
                                                        {new Date(msg.timestamp).toLocaleTimeString(
                                                            undefined,
                                                            { hour: "2-digit", minute: "2-digit" }
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                {sending ? (
                                    <div className="flex justify-start">
                                        <div className="bg-gray-100 rounded-lg px-4 py-3">
                                            <Spinner />
                                        </div>
                                    </div>
                                ) : null}
                                <div ref={messagesEndRef} />
                            </div>

                            <div className="p-4 border-t border-gray-200 bg-white">
                                <div className="flex items-end gap-2">
                                    <textarea
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                        placeholder={
                                            activeFindingContext
                                                ? "Ask about this finding (root cause, validation, prioritization…)"
                                                : "Ask about this audit or request HTML, checklists, emails…"
                                        }
                                        rows={3}
                                        disabled={sending || creatingFindingChat}
                                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)] focus:ring-opacity-20 resize-none bg-white disabled:opacity-60"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleSendMessage}
                                        disabled={
                                            !message.trim() || sending || creatingFindingChat
                                        }
                                        className="p-3 bg-[var(--color-primary-searchmind)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <FiSend className="text-lg" />
                                    </button>
                                </div>
                                <p className="text-xs text-gray-400 mt-2">
                                    Powered by Claude · Enter to send, Shift+Enter for new line
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuditFollowUpModal;
