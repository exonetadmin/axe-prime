'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* ─────────────────────────────────────────────
   Axe Chat — Private Concierge Widget
   AXE PRIME · Gemini 1.5 Flash Integration
   ───────────────────────────────────────────── */

interface ChatMessage {
  id: string;
  role: 'axe' | 'user';
  text: string;
  time: string;
}

/* Gemini history format */
interface GeminiContent {
  role: 'user' | 'model';
  parts: { text: string }[];
}

const WELCOME_TEXT =
  'Olá! Sou o Axe, especialista da Axe Prime, treinado para ajudar com suas dúvidas e apresentar as melhores soluções.';

function timeNow() {
  return new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AxeChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'axe', text: WELCOME_TEXT, time: timeNow() },
  ]);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);

  /* Gemini conversation memory */
  const historyRef = useRef<GeminiContent[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Auto-scroll */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  /* Focus input when chat opens */
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 350);
  }, [open]);

  const toggle = useCallback(() => setOpen((o) => !o), []);

  /* ── Send message & call Gemini ── */
  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || typing) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
      time: timeNow(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setDraft('');
    setTyping(true);

    try {
      const res = await fetch('/api/axe-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: historyRef.current,
          message: text,
        }),
      });

      const data = await res.json();
      const reply =
        data.reply ??
        'Peço desculpas, estou com uma instabilidade momentânea. Pode tentar novamente?';

      historyRef.current = [
        ...historyRef.current,
        { role: 'user', parts: [{ text }] },
        { role: 'model', parts: [{ text: reply }] },
      ];

      const axeMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'axe',
        text: reply,
        time: timeNow(),
      };
      setMessages((prev) => [...prev, axeMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'axe',
          text: 'Estou com uma dificuldade técnica no momento. Tente novamente em alguns instantes.',
          time: timeNow(),
        },
      ]);
    } finally {
      setTyping(false);
    }
  }, [draft, typing]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <>
      {/* ── Chat Window ── */}
      <div className={`axe-chat-window ${open ? 'axe-chat-open' : ''}`}>
        {/* Header */}
        <header className="axe-chat-header">
          <div className="axe-chat-identity">
            <div className="axe-chat-avatar">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/axe-avatar.png"
                alt="Axe — Concierge AXE PRIME"
                className="axe-chat-avatar-img"
              />
            </div>
            <div className="axe-chat-name-block">
              <span className="axe-chat-name">Axe</span>
              <span className="axe-chat-status">
                <span className="axe-chat-status-dot" />
                Online
              </span>
            </div>
          </div>
          <button
            className="axe-chat-close"
            onClick={toggle}
            aria-label="Fechar chat"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        {/* Messages */}
        <div className="axe-chat-messages">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`axe-msg ${msg.role === 'axe' ? 'axe-msg-axe' : 'axe-msg-user'}`}
            >
              <p className="axe-msg-text">{msg.text}</p>
              <span className="axe-msg-time">{msg.time}</span>
            </div>
          ))}

          {/* Typing indicator */}
          {typing && (
            <div className="axe-msg axe-msg-axe">
              <div className="axe-typing">
                <span className="axe-typing-dot" />
                <span className="axe-typing-dot" />
                <span className="axe-typing-dot" />
                <span className="axe-typing-label">Axe está digitando</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="axe-chat-input-bar">
          <input
            ref={inputRef}
            type="text"
            className="axe-chat-input"
            placeholder="Fale com o Axe..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={typing}
          />
          <button
            className={`axe-chat-send ${draft.trim() ? 'axe-chat-send-active' : ''}`}
            onClick={handleSend}
            disabled={!draft.trim() || typing}
            aria-label="Enviar mensagem"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Floating Trigger ── */}
      <button
        className={`axe-chat-trigger ${open ? 'axe-chat-trigger-hidden' : ''}`}
        onClick={toggle}
        aria-label="Abrir chat com o Axe"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      </button>
    </>
  );
}
