#!/usr/bin/env node

import { DatabaseMCPServer } from './server.js';

function parseArgs(args: string[]): { transport?: 'stdio' | 'http'; port?: number; host?: string } {
  const options: { transport?: 'stdio' | 'http'; port?: number; host?: string } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === '--transport') {
      const next = args[++i];
      if (next === 'http' || next === 'stdio') options.transport = next;
    } else if (arg.startsWith('--transport=')) {
      const val = arg.split('=')[1];
      if (val === 'http' || val === 'stdio') options.transport = val;
    } else if (arg === '--port') {
      const next = args[++i];
      if (next) options.port = parseInt(next, 10);
    } else if (arg.startsWith('--port=')) {
      const val = arg.split('=')[1];
      if (val) options.port = parseInt(val, 10);
    } else if (arg === '--host') {
      const next = args[++i];
      if (next) options.host = next;
    } else if (arg.startsWith('--host=')) {
      const val = arg.split('=')[1];
      if (val) options.host = val;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const server = new DatabaseMCPServer();

  const shutdown = async () => {
    console.error('Shutting down Project Guardian MCP server...');
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await server.run(options);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});