"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { FiX, FiSearch, FiSend, FiPlus, FiMessageSquare, FiDownload } from "react-icons/fi";
import { LuBrainCircuit } from "react-icons/lu";
import { useSession } from "next-auth/react";
import Spinner from "@/components/ui/Spinner";
import ReactMarkdown from "react-markdown";

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

const AuditFollowUpModal = ({
    onClose,
    customerId,
    auditId,
    dateRange = { startDate: "", endDate: "" },
    comparisonDateRange = null,
    auditReportSnapshot = {},
    customerName = "",
}) => {
    const { data: session } = useSession();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedChat, setSelectedChat] = useState(null);
    const [message, setMessage] = useState("");
    const [chatHistory, setChatHistory] = useState([]);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);

    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, sending]);

    const fetchChatHistory = useCallback(async () => {
        if (!customerId || !auditId) return;
        try {
            setLoading(true);
            setError(null);
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
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [customerId, auditId]);

    useEffect(() => {
        if (customerId && auditId && session?.user?.id) {
            fetchChatHistory();
        }
    }, [customerId, auditId, session, fetchChatHistory]);

    useEffect(() => {
        if (selectedChat?._id) {
            (async () => {
                try {
                    const res = await fetch(`/api/audit-followup/${selectedChat._id}`);
                    const chat = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(chat.error || "Failed to fetch chat");
                    setMessages(chat.messages || []);
                } catch (err) {
                    console.error(err);
                    setError(err.message);
                }
            })();
        }
    }, [selectedChat?._id]);

    const filteredChats = chatHistory.filter(
        (chat) =>
            chat.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            chat.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleNewChat = async () => {
        if (!customerId || !auditId || !session?.user?.id) return;
        try {
            setLoading(true);
            setError(null);
            const title = `Audit follow-up — ${dateRange.startDate} to ${dateRange.endDate}`;
            const res = await fetch("/api/audit-followup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customerId,
                    auditId,
                    title,
                    dateRange,
                    comparisonDateRange,
                    auditReportSnapshot,
                    customerName,
                }),
            });
            const newChat = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(newChat.error || "Failed to create chat");
            setChatHistory((prev) => [newChat, ...prev]);
            setSelectedChat(newChat);
            setMessages([]);
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSendMessage = async () => {
        if (!message.trim() || !selectedChat || sending) return;

        const userMessage = message.trim();
        setMessage("");
        setSending(true);
        setError(null);

        const tempUserMsg = {
            _id: `temp-${Date.now()}`,
            type: "user",
            content: userMessage,
            timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, tempUserMsg]);

        try {
            const res = await fetch(`/api/audit-followup/${selectedChat._id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userMessage }),
            });
            const aiMessage = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(aiMessage.error || "Failed to send message");
            setMessages((prev) => [
                ...prev.filter((m) => m._id !== tempUserMsg._id),
                tempUserMsg,
                {
                    _id: `ai-${Date.now()}`,
                    type: "ai",
                    content: aiMessage.content,
                    timestamp: aiMessage.timestamp || new Date().toISOString(),
                },
            ]);
            fetchChatHistory();
        } catch (err) {
            console.error(err);
            setError(err.message);
            setMessages((prev) => prev.filter((m) => m._id !== tempUserMsg._id));
        } finally {
            setSending(false);
        }
    };

    return (
        <div
            id="AuditFollowUpModal"
            className="fixed inset-0 z-50 flex items-center justify-center glassmorphism2"
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-followup-title"
        >
            <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl h-[85vh] relative flex overflow-hidden">
                <button
                    type="button"
                    onClick={onClose}
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
                        {loading ? (
                            <div className="flex items-center justify-center p-8">
                                <Spinner />
                            </div>
                        ) : filteredChats.length === 0 ? (
                            <div className="p-4 text-center text-sm text-gray-400">
                                {searchQuery ? "No chats found" : "No chats yet. Click + to start."}
                            </div>
                        ) : (
                            filteredChats.map((chat) => (
                                <div
                                    key={chat._id}
                                    onClick={() => setSelectedChat(chat)}
                                    className={`p-4 border-b border-gray-200 cursor-pointer transition-colors hover:bg-white ${
                                        selectedChat?._id === chat._id
                                            ? "bg-white border-l-4 border-l-[var(--color-primary-searchmind)]"
                                            : ""
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
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
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="flex-1 flex flex-col min-w-0">
                    {!selectedChat ? (
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
                                <h2 className="text-base font-semibold text-gray-900 mb-1 truncate">
                                    {selectedChat.title}
                                </h2>
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
                                {messages.length === 0 ? (
                                    <div className="flex items-center justify-center h-full">
                                        <p className="text-sm text-gray-400 text-center max-w-md">
                                            Ask about priorities, channel trade-offs, or say e.g.
                                            &quot;Create a client-ready HTML summary of the top 5
                                            actions.&quot;
                                        </p>
                                    </div>
                                ) : (
                                    messages.map((msg, idx) => {
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
                                        placeholder="Ask about this audit or request HTML, checklists, emails…"
                                        rows={3}
                                        disabled={sending}
                                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)] focus:ring-opacity-20 resize-none bg-white disabled:opacity-60"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleSendMessage}
                                        disabled={!message.trim() || sending}
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
