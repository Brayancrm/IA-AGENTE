import { NextResponse } from 'next/server';

export function getBackendBaseUrl(): string {
  return String(
    process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || ''
  ).replace(/\/$/, '');
}

/** Repassa o pedido ao backend Railway (evita CORS no browser). */
export async function proxyRequestToBackend(
  backendPath: string,
  request: Request
): Promise<NextResponse> {
  const base = getBackendBaseUrl();
  if (!base) {
    return NextResponse.json(
      {
        status: 'error',
        error: 'NEXT_PUBLIC_BACKEND_URL / BACKEND_URL não configurado no servidor Next.js'
      },
      { status: 500 }
    );
  }

  const method = request.method.toUpperCase();
  const headers: Record<string, string> = {};
  const contentType = request.headers.get('content-type');
  if (contentType) headers['Content-Type'] = contentType;
  const auth = request.headers.get('authorization');
  if (auth) headers.Authorization = auth;

  let body: string | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    try {
      body = await request.text();
    } catch {
      body = undefined;
    }
  }

  let res: Response;
  try {
    res = await fetch(`${base}${backendPath}`, {
      method,
      headers,
      body: body && body.length > 0 ? body : undefined
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha de rede ao contactar o backend';
    return NextResponse.json({ status: 'error', error: msg }, { status: 502 });
  }

  const text = await res.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { status: 'error', error: text.slice(0, 500) };
    }
  }
  return NextResponse.json(data, { status: res.status });
}
