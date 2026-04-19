import { NextResponse } from 'next/server';

/**
 * Proxy: grava bearer_token em Firestore configs/api_panel (só master no backend).
 * Body: { userId: string, bearer_token: string }
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

  const res = await fetch(`${base}/api/panel/save-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({ success: false, error: 'Resposta inválida do backend' }));
  return NextResponse.json(data, { status: res.status });
}
