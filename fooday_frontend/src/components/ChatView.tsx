'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Plus, Bot } from 'lucide-react';
import { chatService, ChatResponse } from '@/services/api';

interface Message {
  isUser: boolean;
  message: string;
  time: string;
  suggestedDishes?: string[];
  /** when true, chips send their own label verbatim; otherwise wrapped as "Tell me more about …" */
  chipsVerbatim?: boolean;
}

interface ChatViewProps {
  initialMessageToSend?: string;
  onClearInitialMessage?: () => void;
}

const now = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const WELCOME: Message = {
  isUser: false,
  message:
    "Hi, I'm Foodie AI 👋 Tell me your mood or cravings and I'll find the perfect dish for you today.",
  time: 'Now',
  suggestedDishes: [
    'Tell me more about Phở Bò',
    'I want something spicy 🌶️',
    'Healthy & light, please',
    'Surprise me!',
  ],
  chipsVerbatim: true,
};

export default function ChatView({
  initialMessageToSend,
  onClearInitialMessage,
}: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend ?? inputValue).trim();
    if (!text || isLoading) return;

    if (!textToSend) setInputValue('');

    setMessages((prev) => [...prev, { isUser: true, message: text, time: now() }]);
    setIsLoading(true);

    const response: ChatResponse | null = await chatService.sendMessage(text);
    setIsLoading(false);

    setMessages((prev) => [
      ...prev,
      response
        ? {
            isUser: false,
            message: response.reply,
            time: now(),
            suggestedDishes: response.suggested_dishes,
          }
        : {
            isUser: false,
            message:
              "I can't reach the kitchen server right now 😢 Please try again in a moment.",
            time: now(),
          },
    ]);
  };

  const handleChip = (label: string, verbatim?: boolean) => {
    handleSend(verbatim ? label : `Tell me more about ${label}`);
  };

  useEffect(() => {
    if (!initialMessageToSend) return;
    // Defer out of the effect body so the send isn't a synchronous setState.
    const id = setTimeout(() => {
      handleSend(initialMessageToSend);
      onClearInitialMessage?.();
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessageToSend]);

  return (
    <div className="chat animate-fade-in">
      {/* Header */}
      <header className="chat-header glass">
        <div className="avatar">
          <Bot size={22} color="#fff" />
          <span className="online" />
        </div>
        <div className="meta">
          <h2 className="bot-name">Foodie AI</h2>
          <span className="status">
            <span className="status-dot" /> Online
          </span>
        </div>
      </header>

      {/* Messages */}
      <div className="messages">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`row ${msg.isUser ? 'user' : 'ai'}`}
            style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
          >
            <div className={`bubble ${msg.isUser ? 'user' : 'ai'}`}>
              <p className="text">{msg.message}</p>
              {!msg.isUser && msg.suggestedDishes && msg.suggestedDishes.length > 0 && (
                <div className="chips">
                  {msg.suggestedDishes.map((dish) => (
                    <button
                      key={dish}
                      onClick={() => handleChip(dish, msg.chipsVerbatim)}
                      className="chip"
                    >
                      {dish}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="time">{msg.time}</span>
          </div>
        ))}

        {isLoading && (
          <div className="row ai">
            <div className="bubble ai typing">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="composer glass">
        <button className="attach" aria-label="Add attachment">
          <Plus size={20} />
        </button>
        <input
          type="text"
          placeholder="Ask Foodie AI anything…"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="input"
          aria-label="Message"
        />
        <button
          onClick={() => handleSend()}
          className="send"
          disabled={!inputValue.trim() || isLoading}
          aria-label="Send message"
        >
          <Send size={17} />
        </button>
      </div>

      <style jsx>{`
        .chat {
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        /* Desktop: center the conversation column in the wide content area */
        @media (min-width: 1024px) {
          .chat .messages,
          .chat .composer {
            max-width: 860px;
            margin-inline: auto;
            width: 100%;
          }
        }
        .chat-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: clamp(12px, 3vw, 15px) clamp(16px, 5vw, 20px);
          border-bottom: 1px solid var(--border);
          z-index: 5;
          flex-shrink: 0;
        }
        .avatar {
          position: relative;
          width: 46px;
          height: 46px;
          border-radius: var(--r-full);
          background: var(--grad-primary);
          display: grid;
          place-items: center;
          box-shadow: var(--shadow-primary);
        }
        .online {
          position: absolute;
          right: 0;
          bottom: 0;
          width: 12px;
          height: 12px;
          border-radius: var(--r-full);
          background: var(--online);
          border: 2.5px solid var(--bg);
          animation: pulseRing 2.4s infinite;
        }
        .bot-name {
          font-size: 1.03125rem;
          font-weight: 700;
          color: var(--text);
          line-height: 1.2;
        }
        .status {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 0.78125rem;
          color: var(--text-soft);
        }
        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: var(--r-full);
          background: var(--online);
        }
        .messages {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 22px clamp(14px, 4vw, 18px);
          display: flex;
          flex-direction: column;
          gap: 16px;
          background: var(--surface-2);
        }
        .row {
          display: flex;
          flex-direction: column;
          max-width: 88%;
          animation: bubbleIn 0.4s var(--ease-out) both;
        }
        .row.user {
          align-self: flex-end;
          align-items: flex-end;
        }
        .row.ai {
          align-self: flex-start;
          align-items: flex-start;
        }
        .bubble {
          padding: 12px 16px;
          font-size: 0.9375rem;
          line-height: 1.5;
          border-radius: 20px;
        }
        .bubble.user {
          background: var(--grad-primary);
          color: #fff;
          border-bottom-right-radius: 6px;
          box-shadow: var(--shadow-primary);
        }
        .bubble.ai {
          background: var(--surface);
          color: var(--text);
          border: 1px solid var(--border);
          border-bottom-left-radius: 6px;
          box-shadow: var(--shadow-sm);
        }
        .text {
          white-space: pre-wrap;
          word-break: break-word;
        }
        .time {
          font-size: 0.6875rem;
          color: var(--text-faint);
          margin-top: 6px;
          padding: 0 6px;
        }
        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px dashed var(--border-strong);
        }
        .chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--primary-soft);
          color: var(--primary-strong);
          border: 1px solid transparent;
          min-height: 44px;
          padding: 0 16px;
          border-radius: var(--r-full);
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          transition: transform var(--dur-fast) var(--ease),
            background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease),
            box-shadow var(--dur-fast) var(--ease);
        }
        .chip:hover {
          transform: translateY(-3px);
          background: var(--grad-primary);
          color: #fff;
          box-shadow: var(--shadow-primary);
        }
        .chip:active {
          transform: translateY(-1px) scale(0.97);
        }
        .typing {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 15px 18px;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: var(--r-full);
          background: var(--text-faint);
          animation: typingBounce 1.3s infinite;
        }
        .dot:nth-child(2) {
          animation-delay: 0.18s;
        }
        .dot:nth-child(3) {
          animation-delay: 0.36s;
        }
        .composer {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px clamp(12px, 4vw, 16px) calc(12px + env(safe-area-inset-bottom, 0px));
          border-top: 1px solid var(--border);
          z-index: 5;
          flex-shrink: 0;
        }
        .attach {
          flex-shrink: 0;
          width: 44px;
          height: 44px;
          border-radius: var(--r-full);
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--primary-strong);
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: transform var(--dur-fast) var(--ease),
            background var(--dur-fast) var(--ease);
        }
        .attach:hover {
          transform: rotate(90deg);
          background: var(--primary-soft);
        }
        .input {
          flex: 1;
          height: 48px;
          padding: 0 18px;
          border-radius: var(--r-full);
          border: 1px solid var(--border-strong);
          background: var(--surface-2);
          color: var(--text);
          font-size: 1rem;
          outline: none;
          min-width: 0;
          transition: border-color var(--dur-fast) var(--ease),
            box-shadow var(--dur-fast) var(--ease);
        }
        .input::placeholder {
          color: var(--text-faint);
        }
        .input:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 4px var(--ring);
        }
        .send {
          flex-shrink: 0;
          width: 44px;
          height: 44px;
          border-radius: var(--r-full);
          border: none;
          background: var(--grad-primary);
          color: #fff;
          display: grid;
          place-items: center;
          cursor: pointer;
          box-shadow: var(--shadow-primary);
          transition: transform var(--dur-fast) var(--ease), opacity var(--dur-fast) var(--ease);
        }
        .send:hover:not(:disabled) {
          transform: scale(1.07);
        }
        .send:active:not(:disabled) {
          transform: scale(0.92);
        }
        .send:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          box-shadow: none;
        }
      `}</style>
    </div>
  );
}
