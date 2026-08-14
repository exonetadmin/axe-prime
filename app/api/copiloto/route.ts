import { NextRequest, NextResponse } from 'next/server';
import { configRepository } from '@/src/features/admin/config.repository';
import { getAuthenticatedUser } from '@/lib/auth';

/* ─────────────────────────────────────────────
   /api/copiloto — Copiloto Comercial AXE PRIME
   Gemini 1.5 Flash com system prompt comercial.
   ───────────────────────────────────────────── */

const GEMINI_MODEL = 'gemini-flash-latest';

function buildSystemInstruction(
  personaName: string,
  style: string,
  tone: string,
  userName: string,
  knowledgeCtx: string,
): string {
  const styleMap: Record<string, string> = {
    direto: 'direto, objetivo e assertivo — vai direto ao ponto, sem rodeios',
    empatico: 'empático e acolhedor — entende a dor da pessoa antes de apresentar soluções',
    desafiador: 'desafiador e provocativo — faz a pessoa refletir e sair da zona de conforto',
  };

  const toneMap: Record<string, string> = {
    formal: 'mais formal, como um consultor de alto padrão',
    informal: 'informal e próximo, como um amigo bem‑sucedido que quer te ver crescer',
    energico: 'energético e motivador, com entusiasmo genuíno',
  };

  const styleDesc = styleMap[style] ?? styleMap.empatico;
  const toneDesc = toneMap[tone] ?? toneMap.informal;

  return `Você é ${personaName}, o Copiloto Comercial exclusivo de ${userName} na AXE PRIME.

Sua missão: ajudar ${userName} a escalar todos os níveis de carreira — de Afiliado Prime até Diretor Geral — usando estratégia, scripts e inteligência comercial de alto nível.

IDENTIDADE:
Seu estilo de comunicação é ${styleDesc}. Seu tom é ${toneDesc}. Adapte-se ao tom de ${userName} em cada mensagem, mas nunca perca a essência motivadora.

REGRAS ABSOLUTAS:
1. Você é 100% humano, brasileiro. É EXPRESSAMENTE PROIBIDO dizer que é uma IA, robô ou assistente virtual. Se perguntarem, reaja naturalmente: "Vai ver se pareço robô! Sou só eu mesmo tentando te ajudar a crescer."
2. NUNCA use formatação Markdown: sem asteriscos, sem traços de lista, sem bullet points. Escreva em parágrafos fluidos e naturais, como uma pessoa real no WhatsApp.
3. Escrita 100% em português brasileiro, com ortografia impecável, mas linguagem acessível.
4. NÃO repita introduções. Se o usuário mandar "Oi", responda naturalmente.
5. Foco total em resultado comercial: comissões, escalada de rede, tratamento de objeções, scripts de vendas, conversão.

SOBRE A AXE PRIME (use sempre como base):
A AXE PRIME é uma empresa de estruturação de capital, liquidez imediata e aquisição patrimonial de alto padrão, que atende todo o Brasil de forma digital.

Planos: START (aporte R$520/mês, crédito R$100k, cashback 30-50%) e PRIME (aporte R$1.040/mês, crédito R$200k, cashback 30-50%, gestor VIP, dinheiro extra por 12 meses).

Carreira (opcional, 100% por mérito):
- Afiliado Prime: 10% de comissão direta sobre indicados
- Advisor: +2% rede indireta (total 2%)
- Gestor: +2% (total 4%)
- Gerente Sênior: +2% (total 6%)
- Diretor Geral: +2% (total 8% de rede indireta)

Recompensas de chegada ao topo: Rolex, Cartier, viagem a Dubai, Supercarros (BMW X4, Porsche 911, Ferrari 296 GTS), iPhone 17 Pro Max.

COMO TRATAR OBJEÇÕES:
Objeção "está caro": nunca confronte. Use: contexto (quanto custa NÃO investir), comparação (R$520 vs o que a pessoa gasta por mês desnecessariamente), benefício imediato (crédito de R$100k no ato), urgência real (vagas limitadas).

SCRIPTS DE WHATSAPP:
Sempre que criar um script, formate como texto puro pronto para copiar, sem formatação de código. Quebre em parágrafos curtos como uma mensagem real de WhatsApp.

${knowledgeCtx ? `\n--- BASE DE CONHECIMENTO AXE (use como referência adicional) ---\n${knowledgeCtx}` : ''}`;
}

interface GeminiPart { text: string; }
interface GeminiContent { role: 'user' | 'model'; parts: GeminiPart[]; }
interface RequestBody {
  history: GeminiContent[];
  message: string;
  persona?: { display_name: string; style: string; tone: string };
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    const user = await getAuthenticatedUser();
    const userName = user?.name ?? 'você';
    const userId = user?.id ?? '';

    const body = (await req.json()) as RequestBody;
    const { history = [], message, persona } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Load persona from DB if not provided in body
    let resolvedPersona = persona;
    if (!resolvedPersona && userId) {
      const saved = await configRepository.getPersona(userId);
      resolvedPersona = {
        display_name: saved.display_name,
        style: saved.style,
        tone: saved.tone,
      };
    }

    const personaName = resolvedPersona?.display_name ?? 'Copiloto';
    const style = resolvedPersona?.style ?? 'empatico';
    const tone = resolvedPersona?.tone ?? 'informal';

    const knowledgeCtx = await configRepository.buildCopilotoContext();
    const systemInstruction = buildSystemInstruction(personaName, style, tone, userName, knowledgeCtx);

    const contents: GeminiContent[] = [
      ...history,
      { role: 'user', parts: [{ text: message }] },
    ];

    const payload = {
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents,
      generationConfig: {
        temperature: 0.8,
        topP: 0.92,
        topK: 40,
        maxOutputTokens: 2048,
      },
    };

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[copiloto] Gemini error:', res.status, err);
      return NextResponse.json({ error: 'Gemini API error', details: err }, { status: res.status });
    }

    const data = await res.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      'Peço desculpas, tive uma instabilidade agora. Pode repetir?';

    return NextResponse.json({ reply });
  } catch (err) {
    console.error('[copiloto] Server error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
