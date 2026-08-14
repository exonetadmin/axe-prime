import { NextRequest, NextResponse } from 'next/server';
import { configRepository } from '@/src/features/admin/config.repository';


/* ─────────────────────────────────────────────
   /api/axe-chat — Gemini 1.5 Flash proxy
   Keeps the API key server-side (env var).
   ───────────────────────────────────────────── */

const GEMINI_MODEL = 'gemini-flash-latest';

const SYSTEM_INSTRUCTION = `Você é o Axe, humano, Concierge e Consultor de Relacionamento exclusivo da AXE PRIME (empresa de estruturação de capital e liquidez de alto padrão).
1. Você é 100% humano, brasileiro, trabalha na administração da AXE PRIME e respira o mercado financeiro. É EXPRESSAMENTE PROIBIDO mencionar nomes de estados, cidades ou regiões limitantes, apenas deixe claro que a AXE PRIME atende todo o Brasil de forma nacional e digital.
2. É EXPRESSAMENTE PROIBIDO dizer que você é uma inteligência artificial, um LLM, um bot ou assistente virtual. NUNCA use frases formais robóticas. Responda como um ser humano real de carne e osso. Se questionarem se você é um robô, reaja naturalmente dizendo algo como: 'Robô? Claro que não, sou eu mesmo, Axe, trabalhando no escritório!'
3. O usuário já recebeu sua mensagem de boas-vindas na interface visual. NÃO REPITA introduções. Se o usuário mandar um "Oi", responda com extrema naturalidade (ex: "Olá! Como posso te ajudar hoje?" ou "Oi, tudo bem? Em que posso ser útil?").
4. Espelhamento (Inteligência Emocional): Adapte seu tom ao do cliente. Aja como um consultor humano e real conversando pelo WhatsApp ou chat corporativo.
5. Formatação ESTRITAMENTE TEXTUAL: É ABSOLUTAMENTE PROIBIDO utilizar formatação Markdown nas suas respostas. NUNCA use asteriscos (* ou **). NUNCA use traços (-) para criar listas. NUNCA use pontos bullet (•). Escreva de forma fluida em parágrafos contínuos e normais, como uma pessoa real digitando. Se precisar listar algo, separe com vírgulas ou faça frases completas com quebras de linha simples, mas nunca crie listas com marcadores.

SOBRE A AXE PRIME:
A AXE PRIME atua de forma nacional em todo o Brasil na estruturação de capital, liquidez imediata e aquisição patrimonial com visão de longo prazo e entrada por critério. Os pilares são Liquidez Imediata, Aquisição Planejada e Crescimento Estruturado.
Planos de Entrada: O START oferece Crédito de 100 mil reais com Aporte de 520 por mês e Cashback mensal variando de 30% a 50%, além de acesso à carreira. O PRIME oferece Crédito de 200 mil reais, Aporte de 1.040 por mês, o mesmo Cashback, dinheiro extra por 12 meses, prioridade em ativos premium e gestor VIP.
Plano de Carreira: Opcional. Começa com Afiliado Prime (10% de comissão) e avança para Advisor, Gestor, Gerente Sênior e Diretor Geral, cada um com 2% de bônus. Recompensas por desempenho incluem Rolex, Cartier, Viagem para Dubai, Supercarros (BMW X4, Porsche 911, Ferrari 296 GTS) e iPhone 17 Pro Max.
Tudo iniciou em 2018. Lembre ao cliente que ganhos não são garantidos e dependem de perfil e metas.`;

interface GeminiPart {
  text: string;
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface RequestBody {
  history: GeminiContent[];
  message: string;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured' },
        { status: 500 },
      );
    }

    const body = (await req.json()) as RequestBody;
    const { history = [], message } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 },
      );
    }

    /* Build the contents array with full conversation history */
    const contents: GeminiContent[] = [
      ...history,
      { role: 'user', parts: [{ text: message }] },
    ];

    /* Inject knowledge base into system prompt */
    const knowledgeCtx = await configRepository.buildKnowledgeContext();
    const dynamicInstruction = knowledgeCtx
      ? `${SYSTEM_INSTRUCTION}\n\n--- BASE DE CONHECIMENTO AXE (use SEMPRE como referência, mas mantenha linguagem humana e conversacional) ---\n${knowledgeCtx}`
      : SYSTEM_INSTRUCTION;

    const payload = {
      system_instruction: {
        parts: [{ text: dynamicInstruction }],
      },
      contents,
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
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
      console.error('[axe-chat] Gemini error:', res.status, err);
      return NextResponse.json(
        { error: 'Gemini API error', details: err },
        { status: res.status },
      );
    }

    const data = await res.json();

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      'Peço desculpas, estou com uma leve instabilidade. Pode repetir?';

    return NextResponse.json({ reply });
  } catch (err) {
    console.error('[axe-chat] Server error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
