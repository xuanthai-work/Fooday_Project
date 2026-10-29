'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import { Send, Plus, Heart, Reply, X, Star, MapPin, UtensilsCrossed } from 'lucide-react';
import {
  chatService,
  type ChatHistoryMessage,
  type ChatResponse,
  type DishCardInfo,
} from '@/services/api';
import type { Translation } from '@/i18n/translations';
import { useFavorites } from '@/hooks/useFavorites';
import { useFoods, type Food } from '@/hooks/useFoods';
import { useReviewStats } from '@/hooks/useReviewStats';
import { useEmojiRain } from '@/hooks/useEmojiRain';
import { useChatRain } from '@/hooks/useChatRain';
import { useFunEffects } from '@/hooks/useFunEffects';
import { findDishMentions, pickEmojiCategories } from '@/lib/dishMatch';
import { createThrottler } from '@/lib/throttle';
import { useTranslation } from '@/i18n/LanguageContext';
import { formatDistance, useUserLocation } from '@/lib/geo';
import DishDetailModal from './DishDetailModal';
import EmojiRain from './EmojiRain';

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
  /** rich dish cards rendered inside the bubble */
  suggestedCards?: DishCardInfo[];
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

/** How many earlier turns are sent back so the model keeps the context. */
const HISTORY_LIMIT = 6;

/** Quote the AI message so the model knows which bubble the user is answering. */
const withReplyContext = (text: string, reply: ReplyRef) =>
  `The user is replying to this message from you: """${reply.text}"""\n\n${text}`;

/** The last turns of the conversation, in the shape the backend expects. */
const buildHistory = (messages: Message[]): ChatHistoryMessage[] =>
  messages
    .filter((msg) => msg.id !== 'welcome' && msg.message.trim().length > 0)
    .slice(-HISTORY_LIMIT)
    .map((msg) => ({
      role: msg.isUser ? 'user' : 'assistant',
      content: msg.message,
    }));

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
  // On touch screens the like / reply buttons appear after a long press.
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusScrollTimer = useRef<number | null>(null);
  const { favorites } = useFavorites();
  const { foods, byId } = useFoods();
  // Live review average, falling back to the seeded catalog score.
  const { ratingOf } = useReviewStats();
  // GPS position of the user: the backend ranks restaurants by distance.
  const { coords } = useUserLocation();
  const [selectedDish, setSelectedDish] = useState<Food | null>(null);
  const { bursts, trigger: triggerRain } = useEmojiRain();
  const { enabled: funEnabled } = useFunEffects();
  const { celebrated, markCelebrated } = useChatRain();
  // The mini sprinkle repeats at most once every 12 seconds.
  const [allowMini] = useState(() => createThrottler(12000));
  const celebratedRef = useRef(false);

  const scrollToBottom = (smooth = true) => {
    endRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  /**
   * Emoji sprinkle when the customer mentions a dish.
   * The first mention of a session gets the full sprinkle, later ones the mini one.
   */
  const maybeRain = (text: string, force = false) => {
    if (!funEnabled) return;
    const mentions = findDishMentions(text, foods);
    if (!force && mentions.length === 0) return;
    const categories = pickEmojiCategories(mentions);

    const alreadyCelebrated = celebrated || celebratedRef.current;
    if (!alreadyCelebrated) {
      celebratedRef.current = true;
      markCelebrated();
      triggerRain(categories, 'chat');
      return;
    }

    if (!allowMini()) return;
    triggerRain(categories, 'mini');
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  /* Hide the bottom navigation bar while the virtual keyboard is open so the
     composer sits directly on top of it. The visualViewport listener is the
     reliable signal on iOS Safari, where `keyboard-open` is toggled on focus
     but the keyboard can also be dismissed without a blur event. */
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;

    const handleResize = () => {
      if (!vv) return;
      const isKeyboard = window.innerHeight - vv.height > 150;
      if (isKeyboard) {
        document.body.classList.add('keyboard-open');
      } else if (!document.activeElement?.classList.contains('input')) {
        document.body.classList.remove('keyboard-open');
      }
    };

    if (vv) {
      vv.addEventListener('resize', handleResize);
    }

    return () => {
      if (vv) vv.removeEventListener('resize', handleResize);
      if (focusScrollTimer.current !== null) {
        window.clearTimeout(focusScrollTimer.current);
        focusScrollTimer.current = null;
      }
      document.body.classList.remove('keyboard-open');
    };
  }, []);

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

    maybeRain(text);

    const favoriteNames = [...favorites]
      .map((id) => byId[id]?.name)
      .filter((n): n is string => Boolean(n));
    const response: ChatResponse | null = await chatService.sendMessage(
      reply ? withReplyContext(text, reply) : text,
      favoriteNames,
      undefined,
      lang,
      {
        conversation_history: buildHistory(messages),
        user_coords: coords ? { lat: coords.lat, lng: coords.lng } : null,
      },
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
            suggestedCards: response.suggested_cards,
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
    // Dish suggestion chips always celebrate; the generic welcome chips do not.
    maybeRain(label, verbatim !== true);
    handleSend(verbatim ? label : t.chat.tellMoreAbout(label), null);
  };

  /** Open the dish of a chat card in the detail modal. */
  const openDishCard = (card: DishCardInfo) => {
    const dish = byId[card.id];
    if (dish) {
      setSelectedDish(dish);
      return;
    }
    // The dish is not in the local catalog (yet): show the card payload.
    setSelectedDish({
      id: card.id,
      slug: String(card.id),
      name: card.name,
      category: 'Foods',
      restaurant: card.restaurant,
      rating: card.rating,
      image_url: card.image_url,
      images: null,
      tag: null,
      address: card.address ?? null,
      google_map_url: null,
      opening_time: null,
      review_note: null,
      created_by: null,
      branches: null,
    });
  };

  const toggleLike = (id: string) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, liked: !msg.liked } : msg)),
    );
  };

  const startReply = (msg: Message) => {
    setReplyingTo({ id: msg.id, text: msg.message });
    setOpenActionsId(null);
    inputRef.current?.focus();
  };

  // --- Touch: long-press a bot message to reveal its actions ----------------
  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    pressOrigin.current = null;
  };

  const startLongPress = (id: string, event: React.TouchEvent) => {
    if (event.touches.length !== 1) return;
    clearLongPress();
    const touch = event.touches[0];
    pressOrigin.current = { x: touch.clientX, y: touch.clientY };
    longPressTimer.current = setTimeout(() => {
      setOpenActionsId(id);
      longPressTimer.current = null;
    }, 450);
  };

  const moveLongPress = (event: React.TouchEvent) => {
    const origin = pressOrigin.current;
    if (!origin) return;
    const touch = event.touches[0];
    if (Math.hypot(touch.clientX - origin.x, touch.clientY - origin.y) > 10) {
      clearLongPress();
    }
  };

  useEffect(
    () => () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    },
    [],
  );

  // A touch anywhere else closes the revealed actions.
  useEffect(() => {
    if (!openActionsId) return;
    const close = (event: TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(`[data-msg-id="${openActionsId}"]`)) return;
      setOpenActionsId(null);
    };
    document.addEventListener('touchstart', close);
    return () => document.removeEventListener('touchstart', close);
  }, [openActionsId]);

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
      <div className="messages-wrap">
        <div className="messages">
          {messages.map((msg, index) => (
            <div
              key={msg.id}
              data-msg-id={msg.id}
              className={`row ${msg.isUser ? 'user' : 'ai'} ${
                openActionsId === msg.id ? 'actions-open' : ''
              }`}
              style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
              onTouchStart={
                msg.isUser ? undefined : (event) => startLongPress(msg.id, event)
              }
              onTouchMove={msg.isUser ? undefined : moveLongPress}
              onTouchEnd={msg.isUser ? undefined : clearLongPress}
              onTouchCancel={msg.isUser ? undefined : clearLongPress}
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
                      {!msg.isUser && msg.suggestedCards && msg.suggestedCards.length > 0 && (
                        <div className="chat-cards-carousel">
                          {msg.suggestedCards.map((card) => (
                            <button
                              key={`${card.id}-${card.name}`}
                              type="button"
                              className="chat-dish-card"
                              onClick={() => openDishCard(card)}
                            >
                              <span className="card-media">
                                {card.image_url ? (
                                  <Image
                                    src={card.image_url}
                                    alt={card.name}
                                    fill
                                    sizes="(max-width: 640px) 58vw, 190px"
                                    style={{ objectFit: 'cover' }}
                                  />
                                ) : (
                                  <span className="card-media-empty">
                                    <UtensilsCrossed size={18} />
                                  </span>
                                )}
                              </span>
                              <span className="card-body">
                                <span className="card-name">{card.name}</span>
                                <span className="card-restaurant">{card.restaurant}</span>
                                <span className="card-meta">
                                  {ratingOf(card.id, card.rating) > 0 && (
                                    <span className="card-rating">
                                      <Star size={12} fill="var(--star)" color="var(--star)" />
                                      {ratingOf(card.id, card.rating).toFixed(1)}
                                    </span>
                                  )}
                                  {card.distance_km != null && (
                                    <span className="card-distance">
                                      <MapPin size={12} />
                                      {formatDistance(card.distance_km, lang)}
                                    </span>
                                  )}
                                </span>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
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
        <EmojiRain bursts={bursts} />
      </div>

      {/* Input */}
      <div className={`dock glass ${isInputFocused ? 'chat-composer-focused' : ''}`}>
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
          <button
            className="attach"
            aria-label={t.chat.attach}
            onMouseDown={(e) => e.preventDefault()}
          >
            <Plus size={20} />
          </button>
          <input
            ref={inputRef}
            type="text"
            placeholder={t.chat.placeholder}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => {
              setIsInputFocused(true);
              if (typeof document !== 'undefined') {
                document.body.classList.add('keyboard-open');
              }
              // Wait for the keyboard to slide in, then reveal the latest message.
              focusScrollTimer.current = window.setTimeout(() => {
                scrollToBottom(true);
              }, 150);
            }}
            onBlur={() => {
              setIsInputFocused(false);
              if (typeof document !== 'undefined') {
                document.body.classList.remove('keyboard-open');
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
              if (e.key === 'Escape' && replyingTo) setReplyingTo(null);
            }}
            className="input"
            aria-label={t.chat.message}
          />
          <button
            onClick={() => handleSend()}
            onMouseDown={(e) => e.preventDefault()}
            className="send"
            disabled={!inputValue.trim() || isLoading}
            aria-label={t.chat.send}
          >
            <Send size={17} />
          </button>
        </div>
      </div>

      {selectedDish && (
        <DishDetailModal
          dish={selectedDish}
          onClose={() => setSelectedDish(null)}
          onNavigateToChat={(msg) => {
            setSelectedDish(null);
            handleSend(msg);
          }}
        />
      )}

      <style jsx>{`
        .chat {
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        /* Desktop: center the conversation column in the wide content area */
        @media (min-width: 1024px) {
          .chat .messages-wrap,
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
        .messages-wrap {
          flex: 1;
          min-height: 0;
          position: relative;
          display: flex;
          flex-direction: column;
          width: 100%;
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
          opacity: 0;
          transform: translateX(-4px);
          pointer-events: none;
          transition: opacity 0.16s var(--ease), transform 0.16s var(--ease);
        }
        /* Like / reply only appear when the message is hovered (or tabbed to). */
        .row.ai:hover .actions,
        .row.ai:focus-within .actions {
          opacity: 1;
          transform: none;
          pointer-events: auto;
        }
        /* Long-pressed on a touch screen: keep them open for that message. */
        .row.actions-open .actions {
          opacity: 1;
          transform: none;
          pointer-events: auto;
        }
        @media (hover: none) {
          /* No hover on touch: the bubble must not pop the copy callout while
             the press is being held to reveal the actions. */
          .bubble {
            -webkit-touch-callout: none;
          }
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
        /* Rich dish cards: a smooth horizontal carousel inside the bubble */
        .chat-cards-carousel {
          display: flex;
          gap: 10px;
          margin-top: 12px;
          padding: 2px 2px 6px;
          overflow-x: auto;
          scroll-snap-type: x proximity;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .chat-cards-carousel::-webkit-scrollbar {
          display: none;
        }
        .chat-dish-card {
          flex: 0 0 auto;
          width: 178px;
          scroll-snap-align: start;
          display: flex;
          flex-direction: column;
          gap: 0;
          padding: 0;
          overflow: hidden;
          text-align: left;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 14px;
          cursor: pointer;
          transition: transform var(--dur-fast) var(--ease),
            box-shadow var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease);
        }
        .chat-dish-card:hover {
          transform: translateY(-3px);
          border-color: var(--primary);
          box-shadow: var(--shadow-primary);
        }
        .chat-dish-card:active {
          transform: translateY(-1px) scale(0.98);
        }
        .card-media {
          position: relative;
          display: block;
          width: 100%;
          aspect-ratio: 16 / 9;
          background: var(--surface-3);
          overflow: hidden;
        }
        .card-media-empty {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          color: var(--text-faint);
        }
        .card-body {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 9px 10px 11px;
        }
        .card-name {
          font-size: 0.8125rem;
          font-weight: 700;
          color: var(--text);
          line-height: 1.3;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
        }
        .card-restaurant {
          font-size: 0.71875rem;
          color: var(--text-soft);
          line-height: 1.3;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
        }
        .card-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 5px;
          font-size: 0.6875rem;
          color: var(--text-soft);
        }
        .card-rating,
        .card-distance {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          white-space: nowrap;
        }
        .card-distance {
          color: var(--primary-strong);
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
          padding: 10px clamp(12px, 4vw, 16px);
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
