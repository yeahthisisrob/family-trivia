/**
 * Local API: runs the real Lambda handler behind a plain Node HTTP server on
 * :3001, so `just dev` needs no SAM or Docker. Vite proxies /api here.
 *
 * It talks to whatever bucket BUCKET_NAME names, with your AWS credentials.
 * Copy .env.example to .env.local and point it at a dev bucket, never the one
 * your family plays on. See docs/decisions/0005-local-dev-server.md.
 */
import { createServer } from 'node:http';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from './index';

const PORT = Number(process.env.PORT ?? 3001);

if (!process.env.BUCKET_NAME) {
  process.stderr.write(
    'BUCKET_NAME is not set. Copy backend/.env.example to backend/.env.local.\n',
  );
  process.exit(1);
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = Buffer.concat(chunks).toString('utf8');

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers[k] = v;

  const event = {
    httpMethod: req.method ?? 'GET',
    path: url.pathname,
    headers,
    queryStringParameters: url.searchParams.size ? Object.fromEntries(url.searchParams) : null,
    body: body || null,
    isBase64Encoded: false,
    requestContext: {
      requestId: `local-${Date.now()}`,
      identity: { sourceIp: req.socket.remoteAddress },
    },
  } as unknown as APIGatewayProxyEvent;

  try {
    const out = await handler(event, {} as Context, () => undefined);
    if (!out) throw new Error('handler returned nothing');
    res.writeHead(out.statusCode, out.headers as Record<string, string>);
    res.end(out.body);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
  }
}).listen(PORT, () => process.stdout.write(`API on http://localhost:${PORT}\n`));
