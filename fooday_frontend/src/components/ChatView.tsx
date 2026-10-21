'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import { Send, Plus, Heart, Reply, X } from 'lucide-react';
import { chatService, type ChatResponse } from '@/services/api';
import type { Translation } from '@/i18n/translations';
import { useFavorites } from '@/hooks/useFavorites';
import { useFoods } from '@/hooks/useFoods';
import { useTranslation } from '@/i18n/LanguageContext';

interface ReplyRef {
  id: string;
  text: string;
}

interface Message {
  id: string;
  isUser: boolean;
  message: string;
  time: string;
  suggestedDishes?: string[];
  /** when true, chips send their own label verbatim; otherwise wrapped as "Tell me more about …" */
  chipsVerbatim?: boolean;
  liked?: boolean;
  replyTo?: ReplyRef;
}

interface ChatViewProps {
  initialMessageToSend?: string;
  onClearInitialMessage?: () => void;
}

const now = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

let messageSeq = 0;
const nextId = () => `m${Date.now().toString(36)}-${messageSeq++}`;

/** Quote the AI message so the model knows which bubble the user is answering. */
const withReplyContext = (text: string, reply: ReplyRef) =>
  `The user is replying to this message from you: """${reply.text}"""\n\n${text}`;

// Exact strings older backends still return. The UI language wins over these.
const LEGACY_FALLBACKS: Record<
  string,
  keyof Pick<Translation['chat'], 'fallback' | 'unconfigured' | 'emptyIdeas'>
> = {
  "Sorry, I couldn't think of a recommendation just now. Please try again in a moment.":
    'fallback',
  "The AI isn't configured on the server yet (missing GEMINI/Supabase keys).": 'unconfigured',
  'Here are a few ideas for you!': 'emptyIdeas',
};

function localizedReply(response: ChatResponse, t: Translation['chat']): string {
  if (response.fallback === 'error') return t.fallback;
  if (response.fallback === 'unconfigured') return t.unconfigured;
  if (response.fallback === 'empty') return t.emptyIdeas;
  const legacy = LEGACY_FALLBACKS[response.reply];
  return legacy ? t[legacy] : response.reply;
}

export default function ChatView({
  initialMessageToSend,
  onClearInitialMessage,
}: ChatViewProps) {
  const { t, lang } = useTranslation();
  const welcome = useMemo<Message>(
    () => ({
      id: 'welcome',
      isUser: false,
      message: t.chat.welcome,
      time: t.chat.now,
      suggestedDishes: t.chat.welcomeChips,
      chipsVerbatim: true,
    }),
    [t],
  );
  const [messages, setMessages] = useState<Message[]>(() => [welcome]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ReplyRef | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { favorites } = useFavorites();
  const { byId } = useFoods();

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (textToSend?: string, replyOverride?: ReplyRef | null) => {
    const text = (textToSend ?? inputValue).trim();
    if (!text || isLoading) return;

    const reply = replyOverride === undefined ? replyingTo : replyOverride;
    if (!textToSend) setInputValue('');
    setReplyingTo(null);

    setMessages((prev) => [
      ...prev,
      {
        id: nextId(),
        isUser: true,
        message: text,
        time: now(),
        replyTo: reply ?? undefined,
      },
    ]);
    setIsLoading(true);

    const favoriteNames = [...favorites]
      .map((id) => byId[id]?.name)
      .filter((n): n is string => Boolean(n));
    const response: ChatResponse | null = await chatService.sendMessage(
      reply ? withReplyContext(text, reply) : text,
      favoriteNames,
      undefined,
      lang,
    );
    setIsLoading(false);

    setMessages((prev) => [
      ...prev,
      response
        ? {
            id: nextId(),
            isUser: false,
            message: localizedReply(response, t.chat),
            time: now(),
            suggestedDishes: response.suggested_dishes,
          }
        : {
            id: nextId(),
            isUser: false,
            message: t.chat.error,
            time: now(),
          },
    ]);
  };

  const handleChip = (label: string, verbatim?: boolean) => {
    handleSend(verbatim ? label : t.chat.tellMoreAbout(label), null);
  };

  const toggleLike = (id: string) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, liked: !msg.liked } : msg)),
    );
  };

  const startReply = (msg: Message) => {
    setReplyingTo({ id: msg.id, text: msg.message });
    inputRef.current?.focus();
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
          <Image
            src="/foodie-avatar.png"
            alt={t.chat.botName}
            fill
            sizes="46px"
            style={{ objectFit: 'cover', borderRadius: '50%' }}
            preload
          />
          <span className="online" />
        </div>
        <div className="meta">
          <h2 className="bot-name">{t.chat.botName}</h2>
          <span className="status">
            <span className="status-dot" /> {t.chat.online}
          </span>
        </div>
      </header>

      {/* Messages */}
      <div className="messages">
        {messages.map((msg, index) => (
          <div
            key={msg.id}
            className={`row ${msg.isUser ? 'user' : 'ai'}`}
            style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
          >
            {!msg.isUser && (
              <div className="bot-avatar-mini">
                <Image
                  src="/foodie-avatar.png"
                  alt={t.chat.botName}
                  width={28}
                  height={28}
                  style={{ borderRadius: '50%', objectFit: 'cover' }}
                />
              </div>
            )}
            <div className="row-body">
              <div className="bubble-line">
                <div className={`bubble-wrap ${msg.liked ? 'liked' : ''}`}>
                  <div className={`bubble ${msg.isUser ? 'user' : 'ai'}`}>
                    {msg.replyTo && (
                      <div className="quote">
                        <span className="quote-label">{t.chat.botName}</span>
                        <span className="quote-text">{msg.replyTo.text}</span>
                      </div>
                    )}
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
                  {msg.liked && (
                    <span className="react-badge" aria-hidden="true">
                      <Heart size={13} fill="currentColor" />
                    </span>
                  )}
                </div>
                {!msg.isUser && (
                  <div className="actions">
                    <button
                      type="button"
                      className={`action ${msg.liked ? 'liked' : ''}`}
                      aria-label={msg.liked ? t.chat.unlike : t.chat.like}
                      aria-pressed={msg.liked ?? false}
                      title={msg.liked ? t.chat.unlike : t.chat.like}
                      onClick={() => toggleLike(msg.id)}
                    >
                      <Heart size={16} fill={msg.liked ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      type="button"
                      className="action"
                      aria-label={t.chat.reply}
                      title={t.chat.reply}
                      onClick={() => startReply(msg)}
                    >
                      <Reply size={18} />
                    </button>
                  </div>
                )}
              </div>
              <span className="time">{msg.time}</span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="row ai row--typing">
            <div className="bot-avatar-mini">
              <Image
                src="/foodie-avatar.png"
                alt={t.chat.botName}
                width={28}
                height={28}
                style={{ borderRadius: '50%', objectFit: 'cover' }}
              />
            </div>
            <div className="row-body">
              <div className="bubble ai typing">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="dock glass">
        {replyingTo && (
          <div className="reply-bar">
            <Reply size={16} />
            <div className="reply-copy">
              <span className="reply-label">{t.chat.replyingTo(t.chat.botName)}</span>
              <span className="reply-snippet">{replyingTo.text}</span>
            </div>
            <button
              type="button"
              className="reply-cancel"
              aria-label={t.chat.cancelReply}
              title={t.chat.cancelReply}
              onClick={() => setReplyingTo(null)}
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="composer">
          <button className="attach" aria-label={t.chat.attach}>
            <Plus size={20} />
          </button>
          <input
            ref={inputRef}
            type="text"
            placeholder={t.chat.placeholder}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
              if (e.key === 'Escape' && replyingTo) setReplyingTo(null);
            }}
            className="input"
            aria-label={t.chat.message}
          />
          <button
            onClick={() => handleSend()}
            className="send"
            disabled={!inputValue.trim() || isLoading}
            aria-label={t.chat.send}
          >
            <Send size={17} />
          </button>
        </div>
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
          .chat .dock {
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
        .row-body {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .row.user {
          align-self: flex-end;
          align-items: flex-end;
        }
        .row.user .row-body {
          align-items: flex-end;
        }
        .row.ai {
          align-self: flex-start;
          flex-direction: row;
          align-items: flex-end;
          gap: 8px;
        }
        .row.ai .row-body {
          align-items: flex-start;
        }
        .bot-avatar-mini {
          flex-shrink: 0;
          width: 28px;
          height: 28px;
          border-radius: var(--r-full);
          overflow: hidden;
          box-shadow: var(--shadow-sm);
          /* lift the avatar so its bottom lines up with the bubble's bottom edge */
          margin-bottom: 22px;
        }
        .row--typing .bot-avatar-mini {
          margin-bottom: 0;
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
        .bubble-line {
          display: flex;
          align-items: center;
          gap: 2px;
          max-width: 100%;
        }
        .bubble-wrap {
          position: relative;
          min-width: 0;
        }
        .bubble-wrap.liked .bubble {
          margin-bottom: 6px;
        }
        .react-badge {
          position: absolute;
          right: 8px;
          bottom: -8px;
          width: 26px;
          height: 26px;
          border-radius: var(--r-full);
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--heart);
          display: grid;
          place-items: center;
          box-shadow: var(--shadow-sm);
          animation: heartPop 0.28s var(--ease-out);
        }
        .quote {
          display: flex;
          flex-direction: column;
          gap: 1px;
          margin-bottom: 8px;
          padding: 6px 8px;
          border-left: 2px solid rgba(255, 255, 255, 0.75);
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.16);
        }
        .quote-label {
          font-size: 0.6875rem;
          font-weight: 700;
        }
        .quote-text {
          font-size: 0.75rem;
          line-height: 1.35;
          opacity: 0.92;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .actions {
          display: flex;
          align-items: center;
          flex-shrink: 0;
          gap: 0;
        }
        .action {
          width: 32px;
          height: 32px;
          border: none;
          border-radius: var(--r-full);
          background: transparent;
          color: var(--text-faint);
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease),
            transform var(--dur-fast) var(--ease);
        }
        .action:hover {
          background: var(--primary-soft);
          color: var(--primary-strong);
        }
        .action.liked,
        .action.liked:hover {
          color: var(--heart);
          background: rgba(240, 84, 106, 0.12);
        }
        .action:active {
          transform: scale(0.92);
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
        .dock {
          flex-shrink: 0;
          z-index: 5;
          border-top: 1px solid var(--border);
        }
        .reply-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px clamp(12px, 4vw, 16px) 0;
          color: var(--primary-strong);
        }
        .reply-copy {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 1px;
          border-left: 2px solid var(--primary);
          padding-left: 10px;
        }
        .reply-label {
          font-size: 0.75rem;
          font-weight: 700;
        }
        .reply-snippet {
          font-size: 0.8125rem;
          color: var(--text-soft);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .reply-cancel {
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          border: none;
          border-radius: var(--r-full);
          background: var(--surface-2);
          color: var(--text-soft);
          display: grid;
          place-items: center;
          cursor: pointer;
        }
        .reply-cancel:hover {
          color: var(--text);
          background: var(--surface-3);
        }
        .composer {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px clamp(12px, 4vw, 16px) calc(12px + env(safe-area-inset-bottom, 0px));
        }
        @keyframes heartPop {
          0% { transform: scale(0.55); }
          60% { transform: scale(1.16); }
          100% { transform: scale(1); }
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
