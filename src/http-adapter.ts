import http from 'node:http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

export interface HttpAdapterOptions {
  port?: number;
  host?: string;
  serverFactory?: () => Server;
}

/**
 * MCP 2026 Stateless HTTP Transport Adapter for Project Guardian (Genome).
 */
export class HttpAdapter {
  private serverFactory: () => Server;
  private options: HttpAdapterOptions;
  private httpServer?: http.Server;

  constructor(serverOrFactory: Server | (() => Server), options: HttpAdapterOptions = {}) {
    this.serverFactory = typeof serverOrFactory === 'function'
      ? serverOrFactory
      : (options.serverFactory ?? (() => serverOrFactory));
    this.options = {
      port: options.port ?? 8012,
      host: options.host ?? '0.0.0.0',
    };
  }

  async start(): Promise<void> {
    this.httpServer = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        const pathname = url.pathname;

        if (req.method === 'GET' && pathname === '/healthz') {
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          });
          res.end(JSON.stringify({
            status: 'ok',
            server: 'project-mcp',
            role: 'hela-genome',
            transport: 'stateless-http',
            version: '2.0.0-beta-2',
            protocolVersion: '2026-07-28',
          }));
          return;
        }

        if (req.method === 'GET' && (pathname === '/discovery' || pathname === '/mcp')) {
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300',
            'mcp-protocol-version': '2026-07-28',
          });
          res.end(JSON.stringify({
            name: 'project-guardian-mcp',
            version: '2.0.0-beta-2',
            protocolVersion: '2026-07-28',
            role: 'hela-genome',
            capabilities: {
              tools: { listChanged: false },
              resources: { listChanged: false },
              prompts: { listChanged: false },
            },
            cache: {
              tools: { ttlMs: 300000, scope: 'global' },
              resources: { ttlMs: 300000, scope: 'global' },
            },
            endpoints: {
              mcp: '/mcp',
              health: '/healthz',
              discovery: '/discovery',
            },
          }));
          return;
        }

        if (req.method === 'POST' && (pathname === '/' || pathname === '/mcp')) {
          const clientVersion = req.headers['mcp-protocol-version'] as string | undefined;
          if (!clientVersion || clientVersion === '2026-07-28') {
            req.headers['mcp-protocol-version'] = '2025-06-18';
          }
          const accept = (req.headers['accept'] as string) || '';
          if (!accept.includes('text/event-stream') || !accept.includes('application/json')) {
            req.headers['accept'] = 'application/json, text/event-stream';
          }

          let hasAccept = false;
          let hasProtocol = false;
          if (req.rawHeaders) {
            for (let i = 0; i < req.rawHeaders.length; i += 2) {
              const rawH = req.rawHeaders[i];
              if (rawH) {
                const h = rawH.toLowerCase();
                if (h === 'accept') {
                  req.rawHeaders[i + 1] = 'application/json, text/event-stream';
                  hasAccept = true;
                } else if (h === 'mcp-protocol-version') {
                  if (!clientVersion || clientVersion === '2026-07-28') {
                    req.rawHeaders[i + 1] = '2025-06-18';
                  }
                  hasProtocol = true;
                }
              }
            }
            if (!hasAccept) {
              req.rawHeaders.push('Accept', 'application/json, text/event-stream');
            }
            if (!hasProtocol) {
              req.rawHeaders.push('Mcp-Protocol-Version', '2025-06-18');
            }
          }

          const mcpMethod = (req.headers['mcp-method'] as string) || '';
          const mcpName = (req.headers['mcp-name'] as string) || '';

          if (mcpMethod) res.setHeader('mcp-method', mcpMethod);
          if (mcpName) res.setHeader('mcp-name', mcpName);
          res.setHeader('mcp-protocol-version', clientVersion || '2026-07-28');

          const bodyBuffer: Buffer[] = [];
          req.on('data', chunk => bodyBuffer.push(chunk));
          req.on('end', async () => {
            const rawBody = Buffer.concat(bodyBuffer).toString('utf8');
            let parsedBody: any;
            try {
              parsedBody = rawBody ? JSON.parse(rawBody) : null;
            } catch {
              parsedBody = null;
            }

            const method = parsedBody?.method || mcpMethod;

            if (method === 'server/discover') {
              const id = parsedBody?.id ?? null;
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                jsonrpc: '2.0',
                id,
                result: {
                  name: 'project-guardian-mcp',
                  version: '2.0.0-beta-2',
                  protocolVersion: '2026-07-28',
                  role: 'hela-genome',
                  capabilities: { tools: {}, resources: {}, prompts: {} },
                  cache: { tools: { ttlMs: 300000, scope: 'global' } }
                }
              }));
              return;
            }

            try {
              const mcpServer = this.serverFactory();
              const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: undefined,
                enableJsonResponse: true,
              });
              await mcpServer.connect(transport);
              await transport.handleRequest(req, res, parsedBody);
              res.on('close', () => {
                transport.close().catch(() => {});
                mcpServer.close().catch(() => {});
              });
            } catch (transportErr) {
              console.error('Stateless transport error:', transportErr);
              if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  jsonrpc: '2.0',
                  error: { code: -32603, message: 'Internal server error', data: String(transportErr) },
                  id: parsedBody?.id ?? null,
                }));
              }
            }
          });
          return;
        }

        if (req.method === 'GET' && (pathname === '/' || pathname === '/mcp')) {
          res.writeHead(405, { 'Content-Type': 'application/json', Allow: 'POST, GET' });
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Method not allowed in stateless mode. Use POST.' },
            id: null,
          }));
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found', endpoints: ['/mcp', '/healthz', '/discovery'] }));
      } catch (err) {
        console.error('Error handling HTTP request:', err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal server error' },
            id: null,
          }));
        }
      }
    });

    return new Promise((resolve, reject) => {
      this.httpServer!.listen(this.options.port, this.options.host, () => {
        console.error(
          `Project Guardian MCP server running on HTTP (${this.options.host}:${this.options.port}, stateless MCP 2026)`
        );
        resolve();
      });
      this.httpServer!.on('error', reject);
    });
  }

  async close(): Promise<void> {
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve());
      });
    }
  }
}
