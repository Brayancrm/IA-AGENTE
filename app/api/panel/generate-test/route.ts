import { NextResponse } from 'next/server';

/**
 * Proxy para o backend (Railway): gera teste no painel com Bearer no Firestore.
 * Body: { userId: string (master Firebase uid), payload?: object }
 */
export async function POST(request: Request) {
  const base = (
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    ''
  ).replace(/\/$/, '');
  if (!base) {
    return NextResponse.json(
      { success: false, error: 'BACKEND_URL / NEXT_PUBLIC_BACKEND_URL não configurado' },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }

  const res = await fetch(`${base}/api/panel/generate-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({ success: false, error: 'Resposta inválida do backend' }));
  return NextResponse.json(data, { status: res.status });
}
