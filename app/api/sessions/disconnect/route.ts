import { proxyRequestToBackend } from '../../../../lib/backendProxy';

export async function POST(request: Request) {
  return proxyRequestToBackend('/api/sessions/disconnect', request);
}
