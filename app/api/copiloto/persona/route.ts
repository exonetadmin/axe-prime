import { NextRequest, NextResponse } from 'next/server';
import { configRepository } from '@/src/features/admin/config.repository';
import { getAuthenticatedUser } from '@/lib/auth';

/* ─────────────────────────────────────────────
   /api/copiloto/persona — GET/POST persona do usuário
   ───────────────────────────────────────────── */

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const persona = await configRepository.getPersona(user.id);
    return NextResponse.json({ persona });
  } catch (err) {
    console.error('[copiloto/persona] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { display_name, style, tone } = body as {
      display_name?: string;
      style?: string;
      tone?: string;
    };

    if (!display_name?.trim()) {
      return NextResponse.json({ error: 'display_name is required' }, { status: 400 });
    }

    await configRepository.savePersona(
      user.id,
      display_name,
      style ?? 'empatico',
      tone ?? 'informal',
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[copiloto/persona] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
