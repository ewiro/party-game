import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve('site');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json' };
createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (path !== root && !path.startsWith(root + sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const content = await readFile(path);
    response.writeHead(200, { 'Content-Type': `${mime[extname(path)] ?? 'application/octet-stream'}; charset=utf-8` }).end(content);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(8080, '127.0.0.1', () => console.log('http://127.0.0.1:8080'));
