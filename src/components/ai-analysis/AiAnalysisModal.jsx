import React, { useState } from 'react';
import { FiX, FiSearch, FiSend, FiPlus, FiMessageSquare } from 'react-icons/fi';

const AiAnalysisModal = ({ onClose, dateRange = { startDate: '', endDate: '' } }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedChat, setSelectedChat] = useState(null);
    const [message, setMessage] = useState('');

    // Mock chat history data
    const [chatHistory] = useState([
        { id: 1, title: 'Revenue Analysis Q4 2024', date: '2024-12-15', lastMessage: 'What factors contributed to...', period: '2024-10-01 to 2024-12-31' },
        { id: 2, title: 'Customer Segmentation Insights', date: '2024-12-10', lastMessage: 'Analyze customer behavior...', period: '2024-11-01 to 2024-11-30' },
        { id: 3, title: 'Product Performance Review', date: '2024-12-05', lastMessage: 'Which products had the highest...', period: '2024-11-01 to 2024-11-30' },
    ]);

    // Mock messages for selected chat
    const [messages] = useState([
        { id: 1, type: 'user', content: 'Can you analyze the revenue trends for this period?', timestamp: '10:30 AM' },
        { id: 2, type: 'ai', content: 'Based on the data from the selected period, I can see several key trends:\n\n1. Revenue increased by 23% compared to the previous period\n2. Orders grew by 18%\n3. Average order value (AOV) increased by 4.2%\n\nThe main drivers appear to be:\n- Improved conversion rates on product pages\n- Successful promotional campaigns\n- Higher engagement from returning customers', timestamp: '10:31 AM' },
        { id: 3, type: 'user', content: 'What about customer acquisition costs?', timestamp: '10:35 AM' },
        { id: 4, type: 'ai', content: 'Customer Acquisition Cost (CAC) analysis:\n\n- Current CAC: 245 DKK\n- Previous period CAC: 289 DKK\n- Improvement: -15.2%\n\nThis improvement suggests your marketing spend is being used more efficiently. The decrease in CAC while maintaining growth indicates strong campaign optimization.', timestamp: '10:36 AM' },
    ]);

    const filteredChats = chatHistory.filter(chat =>
        chat.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSendMessage = () => {
        if (message.trim()) {
            // Handle sending message
            console.log('Sending message:', message);
            setMessage('');
        }
    };

    const handleNewChat = () => {
        // Handle creating new chat
        setSelectedChat(null);
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
                        {filteredChats.length === 0 ? (
                            <div className="p-4 text-center text-sm text-gray-400">
                                No chats found
                            </div>
                        ) : (
                            filteredChats.map((chat) => (
                                <div
                                    key={chat.id}
                                    onClick={() => setSelectedChat(chat)}
                                    className={`p-4 border-b border-gray-200 cursor-pointer transition-colors hover:bg-white ${selectedChat?.id === chat.id ? 'bg-white border-l-4 border-l-[var(--color-primary-searchmind)]' : ''
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
                                                {chat.lastMessage}
                                            </p>
                                            <p className="text-xs text-gray-400">{chat.date}</p>
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
                                        Period: {selectedChat.period}
                                    </span>
                                </div>
                            </div>

                            {/* Messages Area */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[70%] ${msg.type === 'user' ? 'order-2' : 'order-1'}`}>
                                            <div
                                                className={`rounded-lg px-4 py-3 ${msg.type === 'user'
                                                        ? 'bg-[var(--color-primary-searchmind)] text-white'
                                                        : 'bg-gray-100 text-gray-900'
                                                    }`}
                                            >
                                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                            </div>
                                            <p className={`text-xs text-gray-400 mt-1 ${msg.type === 'user' ? 'text-right' : 'text-left'}`}>
                                                {msg.timestamp}
                                            </p>
                                        </div>
                                    </div>
                                ))}
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