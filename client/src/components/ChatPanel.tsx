import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../types/game.js';
import { socketClient } from '../socket/socketClient.js';
import { Send, MessageSquare, X, Bell } from 'lucide-react';

interface ChatPanelProps {
  messages: ChatMessage[];
  currentUserId: string;
  isOpen: boolean;
  onClose: () => void;
  unreadCount?: number;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  currentUserId,
  isOpen,
  onClose,
}) => {
  const [text, setText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean) return;
    socketClient.socket.emit('send_chat', clean);
    setText('');
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-80 md:w-96 glass-panel-glow border-l border-[#00E5C7]/30 flex flex-col shadow-2xl backdrop-blur-xl transition-all">
      {/* Header */}
      <div className="p-3.5 border-b border-white/10 flex items-center justify-between bg-black/40">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-[#00E5C7]" />
          <h3 className="font-black text-sm text-white tracking-wide">ROOM CHAT</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
        {messages.length === 0 && (
          <div className="text-center py-12 text-slate-500 font-medium">
            No messages yet. Say hi to the room!
          </div>
        )}

        {messages.map((msg) => {
          if (msg.isSystem) {
            return (
              <div
                key={msg.id}
                className="py-1 px-2.5 rounded-lg bg-cyan-950/40 border border-cyan-500/20 text-cyan-200 text-center font-semibold text-[11px] my-1"
              >
                {msg.text}
              </div>
            );
          }

          const isMe = msg.senderId === currentUserId;

          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`font-bold ${isMe ? 'text-[#00E5C7]' : 'text-slate-300'}`}>
                  {isMe ? 'You' : msg.senderName}
                </span>
                <span className="text-[10px] text-slate-500">{formatTime(msg.timestamp)}</span>
              </div>
              <div
                className={`
                  p-2.5 rounded-xl max-w-[85%] break-words
                  ${
                    isMe
                      ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-tr-none'
                      : 'bg-slate-800/90 text-slate-100 rounded-tl-none border border-white/10'
                  }
                `}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form onSubmit={handleSend} className="p-3 border-t border-white/10 bg-black/40 flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type message (max 300 chars)..."
          maxLength={300}
          className="flex-1 bg-slate-900/80 border border-white/15 focus:border-[#00E5C7] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="p-2.5 rounded-xl bg-gradient-to-r from-teal-400 to-[#00E5C7] text-slate-950 font-bold hover:opacity-95 disabled:opacity-40 transition cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
