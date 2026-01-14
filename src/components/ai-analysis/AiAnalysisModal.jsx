import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiSearch, FiSend, FiPlus, FiMessageSquare } from 'react-icons/fi';
import { useSession } from 'next-auth/react';
import Spinner from '@/components/ui/Spinner';
import ReactMarkdown from 'react-markdown';

const AiAnalysisModal = ({ 
    onClose, 
    customerId,
    dateRange = { startDate: '', endDate: '' },
    comparisonMethod = 'Last Period',
    dataSnapshot = {},
    dashboardType = 'other'
}) => {
    const { data: session } = useSession();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedChat, setSelectedChat] = useState(null);
    const [message, setMessage] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);
    
    // Ref for messages area
    const messagesEndRef = useRef(null);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, sending]);

    // Fetch chat history on mount
    useEffect(() => {
        if (customerId && session?.user?.id) {
            fetchChatHistory();
        }
    }, [customerId, session, dashboardType]);

    // Fetch messages when chat is selected
    useEffect(() => {
        if (selectedChat) {
            fetchChatMessages(selectedChat._id);
        }
    }, [selectedChat]);

    const fetchChatHistory = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`/api/ai-analysis?customerId=${customerId}&dashboardType=${dashboardType}`);
            if (!res.ok) throw new Error('Failed to fetch chat history');
            const chats = await res.json();
            setChatHistory(chats);
        } catch (err) {
            console.error('Error fetching chats:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchChatMessages = async (chatId) => {
        try {
            const res = await fetch(`/api/ai-analysis/${chatId}`);
            if (!res.ok) throw new Error('Failed to fetch chat');
            const chat = await res.json();
            setMessages(chat.messages || []);
        } catch (err) {
            console.error('Error fetching chat messages:', err);
            setError(err.message);
        }
    };

    const filteredChats = chatHistory.filter(chat =>
        chat.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSendMessage = async () => {
        if (!message.trim() || !selectedChat || sending) return;

        const userMessage = message.trim();
        setMessage('');
        setSending(true);

        // Optimistically add user message
        const tempUserMsg = {
            _id: Date.now().toString(),
            type: 'user',
            content: userMessage,
            timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, tempUserMsg]);

        try {
            const res = await fetch(`/api/ai-analysis/${selectedChat._id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage })
            });

            if (!res.ok) throw new Error('Failed to send message');
            const aiMessage = await res.json();

            // Add AI response
            setMessages(prev => [...prev, aiMessage]);
            
            // Refresh chat history to update lastMessage
            fetchChatHistory();
        } catch (err) {
            console.error('Error sending message:', err);
            setError(err.message);
            // Remove optimistic user message on error
            setMessages(prev => prev.filter(m => m._id !== tempUserMsg._id));
        } finally {
            setSending(false);
        }
    };

    const handleNewChat = async () => {
        if (!customerId || !session?.user?.id) return;

        try {
            setLoading(true);
            const title = `Analysis - ${dateRange.startDate} to ${dateRange.endDate}`;
            const res = await fetch('/api/ai-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId,
                    title,
                    dateRange,
                    comparisonMethod,
                    dataSnapshot,
                    dashboardType
                })
            });

            if (!res.ok) throw new Error('Failed to create chat');
            const newChat = await res.json();
            
            // Add to chat history and select it
            setChatHistory(prev => [newChat, ...prev]);
            setSelectedChat(newChat);
            setMessages([]);
        } catch (err) {
            console.error('Error creating chat:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div id="AiAnalysisModal" className='fixed inset-0 z-50 flex items-center justify-center glassmorphism2'>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl h-[85vh] relative flex overflow-hidden">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Close modal"
                >
                    <FiX className="text-2xl" />
                </button>

                {/* Left Sidebar - Chat History */}
                <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50">
                    {/* Sidebar Header */}
                    <div className="p-4 border-b border-gray-200 bg-white">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-900">Your Analysis Chats</h3>
                            <button
                                onClick={handleNewChat}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                title="New chat"
                            >
                                <FiPlus className="text-lg text-[var(--color-primary-searchmind)]" />
                            </button>
                        </div>
                        {/* Search Bar */}
                        <div className="relative">
                            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm" />
                            <input
                                type="text"
                                placeholder="Search chats..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)] focus:ring-opacity-20 bg-white"
                            />
                        </div>
                    </div>

                    {/* Chat List */}
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center p-8">
                                <Spinner />
                            </div>
                        ) : error ? (
                            <div className="p-4 text-center text-sm text-red-500">
                                Error loading chats
                            </div>
                        ) : filteredChats.length === 0 ? (
                            <div className="p-4 text-center text-sm text-gray-400">
                                {searchQuery ? 'No chats found' : 'No chats yet. Click + to start.'}
                            </div>
                        ) : (
                            filteredChats.map((chat) => (
                                <div
                                    key={chat._id}
                                    onClick={() => setSelectedChat(chat)}
                                    className={`p-4 border-b border-gray-200 cursor-pointer transition-colors hover:bg-white ${selectedChat?._id === chat._id ? 'bg-white border-l-4 border-l-[var(--color-primary-searchmind)]' : ''
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1">
                                            <FiMessageSquare className="text-[var(--color-primary-searchmind)]" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-medium text-gray-900 truncate mb-1">
                                                {chat.title}
                                            </h4>
                                            <p className="text-xs text-gray-500 truncate mb-1">
                                                {chat.lastMessage || 'New chat'}
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

                {/* Right Side - Chat Area */}
                <div className="flex-1 flex flex-col">
                    {!selectedChat ? (
                        // Empty state
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-50 mb-4">
                                    <FiMessageSquare className="text-2xl text-purple-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Start a New Analysis</h3>
                                <p className="text-sm text-gray-500 mb-4">Ask AI to analyze your performance data</p>
                                <button
                                    onClick={handleNewChat}
                                    className="px-4 py-2 bg-[var(--color-primary-searchmind)] text-white rounded-lg text-sm hover:opacity-90 transition-opacity"
                                >
                                    New Chat
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Chat Header */}
                            <div className="p-4 border-b border-gray-200 bg-white">
                                <h2 className="text-base font-semibold text-gray-900 mb-1">{selectedChat.title}</h2>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <span className="px-2 py-1 bg-purple-50 text-purple-500 rounded">
                                        Period: {selectedChat.dateRange?.startDate} to {selectedChat.dateRange?.endDate}
                                    </span>
                                    <span className="px-2 py-1 bg-blue-50 text-blue-500 rounded">
                                        {selectedChat.comparisonMethod}
                                    </span>
                                </div>
                            </div>

                            {/* Messages Area */}
                            <div id='messageArea' className="flex-1 overflow-y-auto p-6 space-y-4">
                                {messages.length === 0 ? (
                                    <div className="flex items-center justify-center h-full">
                                        <p className="text-sm text-gray-400">Start the conversation by asking a question...</p>
                                    </div>
                                ) : (
                                    messages.map((msg, idx) => (
                                        <div
                                            key={msg._id || idx}
                                            className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                                            id='chatAiMessage'
                                        >
                                            <div className={`max-w-[70%] ${msg.type === 'user' ? 'order-2' : 'order-1'}`}>
                                                <div
                                                    className={`rounded-lg px-4 py-3 ${msg.type === 'user'
                                                            ? 'bg-[var(--color-primary-searchmind)] text-white'
                                                            : 'bg-gray-100 text-gray-900'
                                                        }`}
                                                >
                                                    {msg.type === 'ai' ? (
                                                        <ReactMarkdown
                                                            components={{
                                                                h1: ({ node, ...props }) => <h1 className="text-lg font-bold mb-2 text-gray-900" {...props} />,
                                                                h2: ({ node, ...props }) => <h2 className="text-base font-bold mb-2 text-gray-900" {...props} />,
                                                                h3: ({ node, ...props }) => <h3 className="text-base font-bold mb-2 text-gray-900" {...props} />,
                                                                h4: ({ node, ...props }) => <h4 className="text-sm font-semibold mb-1 text-gray-900" {...props} />,
                                                                p: ({ node, ...props }) => <p className="mb-2 last:mb-0 text-gray-800" {...props} />,
                                                                strong: ({ node, ...props }) => <strong className="font-semibold text-gray-900" {...props} />,
                                                                ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2 space-y-1" {...props} />,
                                                                ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />,
                                                                li: ({ node, ...props }) => <li className="text-gray-800" {...props} />,
                                                                code: ({ node, inline, ...props }) => 
                                                                    inline ? (
                                                                        <code className="bg-gray-200 px-1 py-0.5 rounded text-xs font-mono" {...props} />
                                                                    ) : (
                                                                        <code className="block bg-gray-200 p-2 rounded text-xs font-mono mb-2" {...props} />
                                                                    ),
                                                            }}
                                                        >
                                                            {msg.content}
                                                        </ReactMarkdown>
                                                    ) : (
                                                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                                    )}
                                                </div>
                                                <p className={`text-xs text-gray-400 mt-1 ${msg.type === 'user' ? 'text-right' : 'text-left'}`}>
                                                    {new Date(msg.timestamp).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                                {sending && (
                                    <div className="flex justify-start">
                                        <div className="bg-gray-100 rounded-lg px-4 py-3">
                                            <Spinner />
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input Area */}
                            <div className="p-4 border-t border-gray-200 bg-white">
                                <div className="flex items-end gap-2">
                                    <textarea
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                        placeholder="Ask AI to analyze your data..."
                                        rows={3}
                                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)] focus:ring-opacity-20 resize-none bg-white"
                                    />
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={!message.trim()}
                                        className="p-3 bg-[var(--color-primary-searchmind)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <FiSend className="text-lg" />
                                    </button>
                                </div>
                                <p className="text-xs text-gray-400 mt-2">
                                    Press Enter to send, Shift + Enter for new line
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AiAnalysisModal;