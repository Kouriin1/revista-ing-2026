/**
 * Precalcula la paginación de la revista.
 *
 * Recorre las rutas que montan el libro, deja que el navegador las pagine una
 * sola vez y guarda el resultado en `public/paginacion/` (un archivo por ruta,
 * con la huella del contenido como nombre). En el navegador del lector,
 * PageFlipWrapper usa ese archivo y se ahorra ~2000 medidas de texto en cada
 * carga.
 *
 * Uso:  npm run publicar       (build + este script)
 *       npm run paginar        (solo este, requiere un `npm run build` previo)
 *
 * El JSON va indexado por una huella del contenido. Si se edita un artículo y
 * no se vuelve a ejecutar esto, la huella deja de cuadrar y la revista se
 * pagina en el navegador como siempre: nunca se publica un corte equivocado.
 */
import { spawn } from 'node:child_process';
import { readdir, writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(RAIZ, 'dist');
/* Un archivo por ruta, con la huella como nombre: así la portada no arrastra
   los datos de los siete artículos y cada archivo se puede cachear para
   siempre (si cambia el contenido, cambia el nombre). */
const DIR_SALIDA = path.join(RAIZ, 'public', 'paginacion');
const PUERTO_WEB = 4399;
const PUERTO_CDP = 9400;

/* El viewport da igual para el resultado (la hoja tiene medidas fijas), pero se
   usa uno holgado para que se pagine en modo escritorio y no en modo móvil. */
const VIEWPORT = { width: 1920, height: 1080 };

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => existsSync(p));

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/* Servidor estatico propio para `dist`. Antes se lanzaba `npx astro preview`,
   pero en Windows matar ese proceso no mata el nodo que arranca por debajo:
   quedaba el puerto ocupado y la siguiente ejecucion fallaba. */
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp3': 'audio/mpeg',
};

function servirDist(puerto) {
  const servidor = http.createServer(async (req, res) => {
    try {
      let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let archivo = path.join(DIST, ruta);
      if (!path.extname(archivo)) archivo = path.join(archivo, 'index.html');
      if (!archivo.startsWith(DIST)) { res.writeHead(403).end(); return; }
      const cuerpo = await readFile(archivo);
      res.writeHead(200, { 'content-type': TIPOS[path.extname(archivo)] ?? 'application/octet-stream' });
      res.end(cuerpo);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('no encontrado');
    }
  });
  return new Promise((resolver, rechazar) => {
    servidor.once('error', rechazar);
    servidor.listen(puerto, '127.0.0.1', () => resolver(servidor));
  });
}

/** Rutas construidas que montan el libro. */
async function rutas() {
  const lista = ['/'];
  const dirArt = path.join(DIST, 'articulo');
  if (existsSync(dirArt)) {
    for (const d of await readdir(dirArt, { withFileTypes: true })) {
      if (d.isDirectory()) lista.push(`/articulo/${d.name}/`);
    }
  }
  return lista;
}

async function main() {
  if (!CHROME) {
    console.error('No encontré Chrome ni Edge. Instala uno o ajusta la ruta en scripts/paginar.mjs');
    process.exit(1);
  }
  if (!existsSync(DIST)) {
    console.error('No hay carpeta dist/. Ejecuta `npm run build` antes.');
    process.exit(1);
  }

  let web = null;
  let puertoWeb = PUERTO_WEB;
  for (let intento = 0; intento < 20; intento++) {
    try {
      web = await servirDist(puertoWeb);
      break;
    } catch (e) {
      if (e?.code !== 'EADDRINUSE') throw e;
      puertoWeb++; // puerto ocupado: probamos el siguiente
    }
  }
  if (!web) {
    console.error('No encontré un puerto libre para servir dist/.');
    process.exit(1);
  }

  const navegador = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PUERTO_CDP}`,
    `--user-data-dir=${path.join(RAIZ, 'node_modules', '.cache', 'perfil-paginacion')}`,
    'about:blank',
  ], { stdio: 'ignore' });

  /* El navegador si es un proceso externo: en Windows hay que matar el arbol
     entero o queda vivo en segundo plano. */
  const cerrar = () => {
    try { web.close(); } catch {}
    try {
      if (process.platform === 'win32' && navegador.pid) {
        spawn('taskkill', ['/pid', String(navegador.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        navegador.kill();
      }
    } catch {}
  };
  process.on('exit', cerrar);
  process.on('SIGINT', () => { cerrar(); process.exit(1); });

  // Conectar con el navegador
  let wsUrl;
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PUERTO_CDP}/json/list`);
      const p = (await r.json()).find((t) => t.type === 'page');
      if (p?.webSocketDebuggerUrl) { wsUrl = p.webSocketDebuggerUrl; break; }
    } catch {}
    if (i > 60) { console.error('El navegador no arrancó.'); cerrar(); process.exit(1); }
    await esperar(300);
  }

  const ws = new WebSocket(wsUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pend = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
  };
  const cdp = (method, params = {}) => new Promise((res) => {
    const n = ++id; pend.set(n, res);
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  const ev = async (expr) => (await cdp('Runtime.evaluate',
    { expression: expr, awaitPromise: true, returnByValue: true }))?.result?.value;

  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { ...VIEWPORT, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__PF_VOLCAR__ = true;' });

  /* Se escribe en public/ (la fuente, que hay que versionar) y también en
     dist/ (lo que se está sirviendo), para no obligar a un segundo build. */
  const DIR_DIST = path.join(DIST, 'paginacion');
  for (const d of [DIR_SALIDA, DIR_DIST]) {
    await rm(d, { recursive: true, force: true });
    await mkdir(d, { recursive: true });
  }

  let totalKb = 0;
  let generadas = 0;

  for (const ruta of await rutas()) {
    await cdp('Page.navigate', { url: 'about:blank' });
    await esperar(200);
    await cdp('Page.navigate', { url: `http://127.0.0.1:${puertoWeb}${ruta}` });

    let res = null;
    for (let i = 0; i < 200; i++) {
      await esperar(200);
      res = await ev('window.__PF_RESULTADO__ ?? null');
      if (res) break;
    }
    if (!res) {
      console.warn(`  ⚠ ${ruta}: no se pudo paginar, se omite (el navegador la paginará al vuelo)`);
      continue;
    }
    const json = JSON.stringify({
      version: 1,
      hoja: res.hoja,
      bloques: res.bloques,
      ajustadas: res.ajustadas,
    });
    await writeFile(path.join(DIR_SALIDA, `${res.huella}.json`), json, 'utf8');
    await writeFile(path.join(DIR_DIST, `${res.huella}.json`), json, 'utf8');
    totalKb += json.length / 1024;
    generadas++;
    console.log(
      `  ✓ ${ruta.padEnd(46)} ${String(res.bloques.length).padStart(3)} hojas  ` +
      `${String(Math.round(json.length / 1024)).padStart(4)} kB  ${res.huella}.json`,
    );
  }

  console.log(`\nGuardado en public/paginacion/ — ${generadas} archivos, ${totalKb.toFixed(0)} kB en total`);
  console.log('Recuerda: vuelve a ejecutar `npm run paginar` si editas el contenido.');

  ws.close();
  cerrar();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
