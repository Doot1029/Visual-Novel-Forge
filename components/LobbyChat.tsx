import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';

interface LobbyChatProps {
    chatLog: ChatMessage[];
    onSendMessage: (messageText: string) => void;
    canSendMessage: boolean;
    title: string;
}

const LobbyChat: React.FC<LobbyChatProps> = ({ chatLog, onSendMessage, canSendMessage, title }) => {
    const [message, setMessage] = useState('');
    const chatBodyRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatBodyRef.current) {
            chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
        }
    }, [chatLog]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim() && canSendMessage) {
            onSendMessage(message.trim());
            setMessage('');
        }
    };

    return (
        <div className="bg-accent p-4 rounded-lg flex flex-col h-full">
            <h3 className="text-xl font-semibold mb-2 text-highlight">{title}</h3>
            <div ref={chatBodyRef} className="flex-1 overflow-y-auto pr-2 space-y-2 mb-2 text-sm bg-primary p-2 rounded-md">
                {(chatLog || []).map((chat, index) => (
                    <div key={`${chat.timestamp}-${index}`}>
                        <span className="font-bold text-blue-400">{chat.senderName}: </span>
                        <span>{chat.text}</span>
                    </div>
                ))}
                {(!chatLog || chatLog.length === 0) && (
                    <p className="text-center text-gray-400 italic">No messages yet. Say hi!</p>
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
                <p className="text-center text-sm text-gray-400 italic">Chat is disabled.</p>
            )}
        </div>
    );
};

export default LobbyChat;
