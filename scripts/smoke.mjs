#!/usr/bin/env node
/**
 * 静态站点 HTTP 冒烟：
 * 在本地随机端口以 HTTP 伺服构建产物目录（默认 dist/），
 * 校验首页、构建资源与 SPA 回退均可访问，以退出码报告结果。
 */
import http from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { join, normalize, extname, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] || 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = normalize(join(root, pathname));
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    let data;
    try {
      data = await readFile(file);
    } catch {
      // SPA 回退：任意路径回退到 index.html
      file = join(root, 'index.html');
      data = await readFile(file);
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (err) {
    res.writeHead(500);
    res.end(String(err));
  }
});

function get(port, path) {
  return new Promise((resolveP, rejectP) => {
    const req = http.get({ host: '127.0.0.1', port, path }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolveP({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', rejectP);
    req.setTimeout(5000, () => req.destroy(new Error('request timeout')));
  });
}

let failures = 0;
const check = (name, cond, extra = '') => {
  if (cond) {
    console.log(`  ✔ ${name}`);
  } else {
    failures++;
    console.error(`  ✘ ${name}${extra ? ` —— ${extra}` : ''}`);
  }
};

try {
  await readdir(root); // 目录必须存在
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  console.log(`smoke: 伺服 ${root} @ 127.0.0.1:${port}`);

  const index = await get(port, '/');
  check('GET / 返回 200', index.status === 200, `实际 ${index.status}`);
  check('首页包含挂载点 #root', index.body.includes('id="root"'));
  check('首页包含站点标题', index.body.includes('授时'));

  const assetRefs = [...index.body.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
  check('首页引用了构建资源', assetRefs.length > 0);
  for (const p of assetRefs) {
    const r = await get(port, p);
    check(`GET ${p} 返回 200 且非空`, r.status === 200 && r.body.length > 0, `实际 ${r.status}`);
  }

  const spa = await get(port, '/some/deep/route');
  check('SPA 回退路由返回首页', spa.status === 200 && spa.body.includes('id="root"'));
} catch (err) {
  failures++;
  console.error('smoke 执行异常:', err);
} finally {
  server.close();
}

if (failures > 0) {
  console.error(`SMOKE FAILED（${failures} 项未通过）`);
  process.exit(1);
}
console.log('SMOKE PASSED');
