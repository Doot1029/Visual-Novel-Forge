import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';

interface ChatViewProps {
    chatLog: ChatMessage[];
    onSendMessage: (messageText: string) => void;
    canSendMessage: boolean;
}

const ChatView: React.FC<ChatViewProps> = ({ chatLog, onSendMessage, canSendMessage }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [message, setMessage] = useState('');
    const [unreadCount, setUnreadCount] = useState(0);
    const chatBodyRef = useRef<HTMLDivElement>(null);
    const prevChatLogLength = useRef(chatLog ? chatLog.length : 0);

    // Effect to scroll to the bottom of the chat when new messages arrive or it's expanded
    useEffect(() => {
        if (isExpanded && chatBodyRef.current) {
            chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
        }
    }, [chatLog, isExpanded]);

    // Effect to count unread messages
    useEffect(() => {
        const currentLength = chatLog ? chatLog.length : 0;
        if (!isExpanded && currentLength > prevChatLogLength.current) {
            const newMessagesCount = currentLength - prevChatLogLength.current;
            setUnreadCount(prev => prev + newMessagesCount);
        }
        prevChatLogLength.current = currentLength;
    }, [chatLog, isExpanded]);


    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim() && canSendMessage) {
            onSendMessage(message.trim());
            setMessage('');
        }
    };
    
    const handleToggleExpand = () => {
        // If we are about to close the panel, mark messages as read.
        if (isExpanded) {
            setUnreadCount(0);
        }
        setIsExpanded(!isExpanded);
    };

    const firstUnreadIndex = unreadCount > 0 ? (chatLog || []).length - unreadCount : -1;
    
    return (
        <div className="fixed bottom-4 right-4 w-full max-w-md z-40">
            <div className={`bg-secondary shadow-2xl rounded-lg border-2 border-accent transition-all duration-300 ${isExpanded ? 'h-96' : 'h-12'}`}>
                <button 
                    onClick={handleToggleExpand} 
                    className="w-full h-12 p-3 text-left font-bold text-highlight flex justify-between items-center"
                >
                    <div className="flex items-center gap-2">
                        <span>OOC Chat</span>
                        {unreadCount > 0 && !isExpanded && (
                             <span className="bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </div>
                    <span>{isExpanded ? '▼' : '▲'}</span>
                </button>
                {isExpanded && (
                    <div className="p-3 h-[calc(100%-3rem)] flex flex-col">
                        <div ref={chatBodyRef} className="flex-1 overflow-y-auto pr-2 space-y-2 mb-2 text-sm">
                            {(chatLog || []).map((chat, index) => (
                                <React.Fragment key={`${chat.timestamp}-${index}`}>
                                    {index === firstUnreadIndex && (
                                        <div className="relative my-2 h-px bg-red-500">
                                            <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-secondary px-2 text-xs text-red-400">
                                                New Messages
                                            </span>
                                        </div>
                                    )}
                                    <div>
                                        <span className="font-bold text-blue-400">{chat.senderName}: </span>
                                        <span>{chat.text}</span>
                                    </div>
                                </React.Fragment>
                            ))}
                             {(!chatLog || chatLog.length === 0) && (
                                <p className="text-center text-gray-400 italic">No messages yet.</p>
                            )}
                        </div>
                        {canSendMessage ? (
                            <form onSubmit={handleSend} className="flex gap-2">
                                <input 
                                    type="text"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Type a message..."
                                    className="flex-1 p-2 bg-primary rounded-md outline-none focus:ring-2 focus:ring-highlight"
                                />
                                <button type="submit" className="px-4 py-2 bg-highlight rounded-md font-bold hover:bg-opacity-80">Send</button>
                            </form>
                        ) : (
                             <p className="text-center text-sm text-gray-400 italic">You are spectating.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatView;
