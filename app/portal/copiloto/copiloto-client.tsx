'use client';

/* ═══════════════════════════════════════════════════════════════════════════
   copiloto-client.tsx — Orquestrador client-side: exibe Intro ou Chat
   ─────────────────────────────────────────────────────────────────────────
   Lógica:
     • Na primeira visita (ou sem flag salva) → exibe CopiloIntro
     • Após clicar em "Ativar Agente" → exibe CopiloChat
     • Flag salva em sessionStorage para não mostrar intro toda vez na sessão
═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import CopiloIntro from './copiloto-intro';
import CopiloChat from './copiloto-chat';

interface Persona {
  display_name: string;
  style: string;
  tone: string;
}

interface Props {
  userName: string;
  userId: string;
  initialPersona: Persona;
}

const SESSION_KEY = 'axe-copiloto-started';

export default function CopiloClient({ userName, userId, initialPersona }: Props) {
  /* Começa com null enquanto verifica o sessionStorage (evita flash) */
  const [view, setView] = useState<'intro' | 'chat' | null>(null);

  useEffect(() => {
    /* Se o membro já ativou o agente nesta sessão, vai direto pro chat */
    const alreadyStarted = sessionStorage.getItem(SESSION_KEY) === '1';
    // eslint-disable-next-line react-hooks/exhaustive-deps
    setView(alreadyStarted ? 'chat' : 'intro');
  }, []);

  function handleStart() {
    sessionStorage.setItem(SESSION_KEY, '1');
    setView('chat');
  }

  /* Loading silencioso enquanto resolve o estado de sessão */
  if (view === null) return null;

  if (view === 'intro') {
    return (
      <CopiloIntro
        agentName={initialPersona.display_name}
        userName={userName}
        onStart={handleStart}
      />
    );
  }

  return (
    <CopiloChat
      userName={userName}
      userId={userId}
      initialPersona={initialPersona}
    />
  );
}
