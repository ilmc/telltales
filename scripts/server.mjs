import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {extname, resolve, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 4173;
const DEFAULT_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

const CONTENT_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.webp', 'image/webp']
]);

function pathWithin(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}${sep}`);
}

export function createStaticServer({root = DEFAULT_ROOT} = {}) {
  const resolvedRoot = resolve(root);

  return createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, {'allow': 'GET, HEAD'}).end('Method Not Allowed\n');
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    } catch {
      response.writeHead(400).end('Bad Request\n');
      return;
    }

    let filePath = resolve(resolvedRoot, `.${pathname}`);
    if (!pathWithin(resolvedRoot, filePath)) {
      response.writeHead(403).end('Forbidden\n');
      return;
    }

    try {
      const fileStat = await stat(filePath);
      if (fileStat.isDirectory()) filePath = resolve(filePath, 'index.html');
      const finalStat = await stat(filePath);
      if (!finalStat.isFile()) throw new Error('not a file');
    } catch {
      response.writeHead(404).end('Not Found\n');
      return;
    }

    response.writeHead(200, {
      'content-type': CONTENT_TYPES.get(extname(filePath).toLowerCase()) ?? 'application/octet-stream',
      'cache-control': 'no-store'
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    createReadStream(filePath).pipe(response);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const host = process.env.HOST ?? DEFAULT_HOST;
  const port = Number.parseInt(process.env.PORT ?? `${DEFAULT_PORT}`, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${process.env.PORT}`);
  }
  const server = createStaticServer();
  server.listen(port, host, () => {
    console.log(`Telltales development server: http://${host}:${port}`);
  });
}
