'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import CopiloPersonaForm from './copiloto-persona-form';

/* ─────────────────────────────────────────────────────────────────
   Copiloto Comercial AXE — Interface Principal
   Design: identidade AXE Prime — navy/cyan/glassmorphism
   ───────────────────────────────────────────────────────────────── */

interface Persona {
  display_name: string;
  style: string;
  tone: string;
}

interface ChatMessage {
  id: string;
  role: 'copiloto' | 'user';
  text: string;
  time: string;
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: { text: string }[];
}

/* ── Quick-actions ─────────────────────────────────────────────── */
const QUICK_ACTIONS = [
  {
    id: 'sceptic',
    emoji: '🎭',
    label: 'Simular cliente cético',
    desc: 'Treino de objeção ao vivo',
    prompt:
      'Quero praticar. Você vai ser um cliente difícil e cético que acha que é pirâmide e que está caro. Começa a conversa como esse cliente.',
  },
  {
    id: 'expensive',
    emoji: '💸',
    label: 'Objeção "está caro"',
    desc: 'Argumentos empáticos e práticos',
    prompt:
      'Me ajuda a tratar a objeção de que o plano está caro. Quero argumentos práticos, empáticos e que façam sentido no dia a dia da pessoa.',
  },
  {
    id: 'script',
    emoji: '📋',
    label: 'Script de abordagem',
    desc: 'Mensagem pronta para WhatsApp',
    prompt:
      'Cria um script de abordagem de vendas para eu enviar pelo WhatsApp para alguém que eu ainda não apresentei a AXE PRIME. Quero algo natural, curto e que desperte curiosidade.',
  },
  {
    id: 'diagnosis',
    emoji: '🔍',
    label: 'Diagnóstico do cliente',
    desc: 'Perguntas que revelam a dor financeira',
    prompt:
      'Quais são as 5 melhores perguntas que devo fazer para descobrir a dor financeira do meu cliente e entender se a AXE PRIME é para ele?',
  },
  {
    id: 'rescue',
    emoji: '💬',
    label: 'Mensagem de resgate',
    desc: 'Para quem sumiu depois do interesse',
    prompt:
      'Cria uma mensagem de resgate para mandar no WhatsApp para alguém que demonstrou interesse mas sumiu há alguns dias. Quero que seja natural, sem parecer desesperado.',
  },
  {
    id: 'nextlevel',
    emoji: '📈',
    label: 'Subir de nível',
    desc: 'Plano para avançar na carreira AXE',
    prompt:
      'Me explica o que eu preciso fazer na prática para sair do nível que estou agora e chegar ao próximo nível de carreira da AXE PRIME. Quero um plano de ação claro.',
  },
];

function timeNow() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function buildWelcome(name: string, userName: string): string {
  return `Olá, ${userName.split(' ')[0]}! Sou ${name}, seu Copiloto Comercial na AXE PRIME 🚀\n\nEstou aqui para te ajudar a: vender sem improviso, tratar objeções com segurança, criar scripts que convertem e montar seu plano de carreira.\n\nEscolha um atalho ao lado ou me conta o que está enfrentando agora.`;
}

export default function CopiloChat({
  userName,
  userId,
  initialPersona,
}: {
  userName: string;
  userId: string;
  initialPersona: Persona;
}) {
  const [persona, setPersona] = useState<Persona>(initialPersona);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'copiloto',
      text: buildWelcome(initialPersona.display_name, userName),
      time: timeNow(),
    },
  ]);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [showPersonaForm, setShowPersonaForm] = useState(false);

  const historyRef = useRef<GeminiContent[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = useCallback(
    async (text: string, actionId?: string) => {
      if (!text.trim() || typing) return;

      setActiveAction(actionId ?? null);

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        text: text.trim(),
        time: timeNow(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setDraft('');
      setTyping(true);

      try {
        const res = await fetch('/api/copiloto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            history: historyRef.current,
            message: text.trim(),
            persona,
          }),
        });

        const data = await res.json();
        const reply =
          data.reply ?? 'Peço desculpas, tive uma instabilidade agora. Pode repetir?';

        historyRef.current = [
          ...historyRef.current,
          { role: 'user', parts: [{ text: text.trim() }] },
          { role: 'model', parts: [{ text: reply }] },
        ];

        setMessages((prev) => [
          ...prev,
          { id: `c-${Date.now()}`, role: 'copiloto', text: reply, time: timeNow() },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: 'copiloto',
            text: 'Estou com uma dificuldade técnica agora. Tenta de novo em instantes.',
            time: timeNow(),
          },
        ]);
      } finally {
        setTyping(false);
        setActiveAction(null);
      }
    },
    [typing, persona],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(draft);
      }
    },
    [draft, sendMessage],
  );

  const handlePersonaSave = useCallback(
    (updated: Persona) => {
      setPersona(updated);
      setShowPersonaForm(false);
      historyRef.current = [];
      setMessages([
        {
          id: `welcome-${Date.now()}`,
          role: 'copiloto',
          text: buildWelcome(updated.display_name, userName),
          time: timeNow(),
        },
      ]);
    },
    [userName],
  );

  return (
    <div className="cop-layout">

      {/* ══ SIDEBAR ════════════════════════════════════════════ */}
      <aside className="cop-sidebar">

        {/* Persona card */}
        <div className="cop-persona-card">
          <div className="cop-persona-orb">
            {/* Lightning bolt SVG */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
                fill="rgba(56,189,248,0.15)" stroke="#38bdf8" strokeWidth="1.6"
                strokeLinejoin="round" />
            </svg>
          </div>
          <div className="cop-persona-info">
            <span className="cop-persona-name">{persona.display_name}</span>
            <span className="cop-persona-subtitle">Comercial · AXE Prime</span>
          </div>
          <button
            type="button"
            className="cop-persona-cfg"
            onClick={() => setShowPersonaForm(true)}
            title="Personalizar Copiloto"
            aria-label="Configurar persona"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>

        {/* Quick-actions */}
        <p className="cop-section-label">Atalhos de alto impacto</p>
        <div className="cop-actions-list">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`cop-action-item ${activeAction === a.id ? 'cop-action-loading' : ''}`}
              onClick={() => sendMessage(a.prompt, a.id)}
              disabled={typing}
            >
              <span className="cop-action-emoji">{a.emoji}</span>
              <span className="cop-action-text">
                <span className="cop-action-label">{a.label}</span>
                <span className="cop-action-desc">{a.desc}</span>
              </span>
              {activeAction === a.id && (
                <span className="cop-action-spinner" aria-hidden />
              )}
            </button>
          ))}
        </div>

        {/* Tip */}
        <div className="cop-tip">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>Personalize seu copiloto clicando em ⚙ acima.</span>
        </div>
      </aside>

      {/* ══ CHAT AREA ══════════════════════════════════════════ */}
      <div className="cop-main">

        {/* Header do chat */}
        <header className="cop-chat-header">
          <div className="cop-chat-identity">
            <div className="cop-chat-avatar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
                  fill="rgba(56,189,248,0.2)" stroke="#38bdf8" strokeWidth="1.6"
                  strokeLinejoin="round" />
              </svg>
              <span className="cop-online-dot" aria-hidden />
            </div>
            <div className="cop-chat-id-text">
              <span className="cop-chat-name">{persona.display_name}</span>
              <span className="cop-chat-status">online · AXE Prime</span>
            </div>
          </div>
          <div className="cop-chat-badge">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
                fill="currentColor" />
            </svg>
            Copiloto Comercial
          </div>
        </header>

        {/* Mensagens */}
        <div className="cop-messages-scroll" role="log" aria-live="polite" aria-label="Conversa com o Copiloto">
          <div className="cop-messages-inner">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`cop-msg ${msg.role === 'copiloto' ? 'cop-msg--bot' : 'cop-msg--user'}`}
              >
                {msg.role === 'copiloto' && (
                  <div className="cop-msg-avatar" aria-hidden>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
                        fill="rgba(56,189,248,0.2)" stroke="#38bdf8" strokeWidth="1.8"
                        strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
                <div className="cop-msg-body">
                  <p className="cop-msg-text">{msg.text}</p>
                  <time className="cop-msg-time" dateTime={msg.time}>{msg.time}</time>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {typing && (
              <div className="cop-msg cop-msg--bot">
                <div className="cop-msg-avatar" aria-hidden>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
                      fill="rgba(56,189,248,0.2)" stroke="#38bdf8" strokeWidth="1.8"
                      strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="cop-msg-body">
                  <div className="cop-typing" aria-label="Copiloto digitando…">
                    <span className="cop-dot" /><span className="cop-dot" /><span className="cop-dot" />
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input */}
        <div className="cop-input-zone">
          <div className="cop-input-wrap">
            <textarea
              ref={inputRef}
              className="cop-input"
              placeholder={`Mensagem para ${persona.display_name}… (Enter para enviar)`}
              value={draft}
              rows={1}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={typing}
              aria-label="Mensagem"
            />
            <button
              type="button"
              className={`cop-send ${draft.trim() && !typing ? 'cop-send--active' : ''}`}
              onClick={() => sendMessage(draft)}
              disabled={!draft.trim() || typing}
              aria-label="Enviar"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <p className="cop-input-hint">
            Pressione Enter para enviar · Shift+Enter para nova linha
          </p>
        </div>
      </div>

      {/* ══ MODAL DE PERSONA ═══════════════════════════════════ */}
      {showPersonaForm && (
        <CopiloPersonaForm
          initial={persona}
          onSave={handlePersonaSave}
          onClose={() => setShowPersonaForm(false)}
        />
      )}
    </div>
  );
}
