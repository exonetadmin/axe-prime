'use client';

/* ═══════════════════════════════════════════════════════════════════════════
   neural-bg.tsx — Background animado de rede neural para a landing /copiloto
   ─────────────────────────────────────────────────────────────────────────
   Renderiza um canvas full-viewport com:
     • Partículas (nós) flutuando suavemente
     • Linhas de conexão entre nós próximos (< CONNECTION_DIST)
     • Opacidade proporcional à distância — mais perto = linha mais visível
     • Cores: identidade AXE Prime (navy escuro + cyan #38bdf8)
     • Performance: requestAnimationFrame, ResizeObserver, cleanup automático
   Responsivo: redimensiona e reposiciona partículas no resize da janela.
   Mobile fix: ignora mudanças de altura causadas pelo scroll do browser
               (barra de URL escondendo/aparecendo) para evitar flicker.
═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef } from 'react';

/* ── Configuração visual ──────────────────────────────────────────────── */
const CONFIG = {
  /** Quantidade de partículas — escala com a área da tela */
  BASE_COUNT: 60,
  /** Distância máxima para desenhar linha de conexão (px) */
  CONNECTION_DIST: 160,
  /** Velocidade máxima de drift das partículas */
  MAX_SPEED: 0.35,
  /** Raio base das partículas */
  MIN_RADIUS: 1.2,
  MAX_RADIUS: 3.2,
  /** Cor da partícula / linha — cyan AXE Prime */
  NODE_COLOR: '56, 189, 248',   // rgb equivalente de #38bdf8
  /** Cor de fundo — navy escuro AXE Prime */
  BG_COLOR: '#030b13',
  /**
   * Debounce do ResizeObserver em ms.
   * Evita reinicialização durante scroll mobile (barra de URL aparecendo/sumindo).
   */
  RESIZE_DEBOUNCE: 200,
} as const;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  opacity: number;
};

function makeParticle(w: number, h: number): Particle {
  const speed = () => (Math.random() - 0.5) * CONFIG.MAX_SPEED * 2;
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: speed(),
    vy: speed(),
    r: CONFIG.MIN_RADIUS + Math.random() * (CONFIG.MAX_RADIUS - CONFIG.MIN_RADIUS),
    opacity: 0.35 + Math.random() * 0.65,
  };
}

export default function NeuralBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: Particle[] = [];
    let animId: number;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    /* Largura anterior — usada para detectar resize real vs scroll mobile */
    let lastWidth = 0;

    /*
     * Inicializa / redimensiona canvas + partículas.
     * Usa window.innerWidth/innerHeight para obter dimensões estáveis no mobile.
     * offsetWidth/offsetHeight pode variar quando a barra de URL aparece/some,
     * causando flicker. innerWidth não muda ao fazer scroll.
     */
    function init() {
      if (!canvas) return;
      const w = typeof window !== 'undefined' ? window.innerWidth  : canvas.offsetWidth;
      const h = typeof window !== 'undefined' ? window.innerHeight : canvas.offsetHeight;
      canvas.width  = w;
      canvas.height = h;
      lastWidth = w;
      const area = w * h;
      const count = Math.round(CONFIG.BASE_COUNT * (area / (1440 * 900)));
      const clamped = Math.max(25, Math.min(120, count));
      particles = Array.from({ length: clamped }, () => makeParticle(w, h));
    }

    /* Loop de animação */
    function draw() {
      if (!canvas || !ctx) return;
      const W = canvas.width;
      const H = canvas.height;

      /* Fundo */
      ctx.fillStyle = CONFIG.BG_COLOR;
      ctx.fillRect(0, 0, W, H);

      /* Glow suave no canto superior-esquerdo — warmth da identidade */
      const glow = ctx.createRadialGradient(W * 0.08, H * 0.45, 0, W * 0.08, H * 0.45, W * 0.45);
      glow.addColorStop(0, `rgba(${CONFIG.NODE_COLOR}, 0.06)`);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      /* Mover partículas */
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        /* Bounce nas bordas */
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
      }

      /* Desenhar conexões */
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONFIG.CONNECTION_DIST) {
            const alpha = (1 - dist / CONFIG.CONNECTION_DIST) * 0.22;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(${CONFIG.NODE_COLOR}, ${alpha})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }

      /* Desenhar nós */
      for (const p of particles) {
        /* Glow suave no nó */
        const glowNode = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        glowNode.addColorStop(0, `rgba(${CONFIG.NODE_COLOR}, ${p.opacity * 0.5})`);
        glowNode.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
        ctx.fillStyle = glowNode;
        ctx.fill();

        /* Núcleo da partícula */
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${CONFIG.NODE_COLOR}, ${p.opacity})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    }

    /*
     * ResizeObserver com debounce + filtro de largura.
     *
     * Causa do flicker: quando o usuário scrolla no mobile, o browser esconde
     * ou mostra a barra de URL, o que altera a altura do viewport. Isso dispara
     * o ResizeObserver, chama init() e recria o canvas inteiro → piscada visível.
     *
     * Fix:
     *   1. Debounce de RESIZE_DEBOUNCE ms — descarta disparos rápidos/frequentes.
     *   2. Só reinicializa se a LARGURA do viewport mudou. Mudanças de altura
     *      geradas pela barra de URL são ignoradas silenciosamente.
     */
    const ro = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const currentWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
        if (currentWidth !== lastWidth) {
          init();
        }
      }, CONFIG.RESIZE_DEBOUNCE);
    });
    ro.observe(canvas);

    init();
    draw();

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="neural-bg-canvas"
    />
  );
}
