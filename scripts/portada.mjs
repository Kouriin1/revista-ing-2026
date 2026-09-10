/**
 * Genera la portada compuesta a partir de la foto original.
 *
 *  Recompone la foto a la proporcion de la hoja (8.5/11). La foto es mas
 *  ancha de lo que pide la hoja, asi que hay que anadir alto: las franjas se
 *  rellenan con la propia foto reflejada (espejo). El espejo es continuo en
 *  el empalme por construccion, asi que no hay que desenfocar ni difuminar
 *  nada y la portada queda nitida hasta el borde.
 *
 *  Reescribe ademas la sigla del centro (la foto trae "(CEFIA)") usando los
 *  glifos que ya estan dibujados en ella, para no cambiar de tipografia.
 *
 * Uso:  npm run portada
 * Solo hay que volver a ejecutarlo si cambia la foto original.
 */
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGEN = path.join(RAIZ, 'src/assets/imagenes/volumenII.jpeg');
const DESTINO = path.join(RAIZ, 'src/assets/imagenes/portada-volumenII.jpg');

const RATIO_HOJA = 8.5 / 11;

/* La foto es mas ancha que la hoja, asi que sobra ancho o falta alto. Recortar
   un poco de ancho reduce mucho la franja que hay que inventar arriba y abajo.
   Medido sobre la imagen: el logo empieza en x=58 y el "vol II" acaba en
   x=765, asi que 42px por lado dejan ~14px de aire y no tocan nada. Lo unico
   que se recorta son los swooshes decorativos, que ya sangran por el borde.
   Con esto la franja difuminada baja del 7.3% al 2.4% por lado. */
const RECORTE_LATERAL = 42;

/* La sigla del centro se compone reutilizando los glifos que ya estan
   dibujados en la foto, asi conserva exactamente la tipografia del diseno.
   Poner null para dejar la portada tal cual viene. */
const SIGLA = 'CIFIA';

/* Medidas tomadas de la imagen (perfil de columnas de la fila del texto).
   La foto trae "(CEFIA)" y de ahi salen todos los glifos que hacen falta. */
const TEXTO = {
  x0: 468, x1: 543,        // franja que se limpia (con margen)
  y0: 221, y1: 246,        // la tinta ocupa y=224..242
  yFondoArriba: 219,       // filas limpias para interpolar el fondo
  yFondoAbajo: 248,
  centro: 505.5,           // la sigla va centrada aqui
  separacion: 3,           // px de aire entre glifos
  glifos: {
    '(': [472, 474],
    'C': [478, 489],
    'E': [492, 500],
    'F': [504, 512],
    'I': [516, 517],
    'A': [521, 533],
    ')': [536, 539],
  },
};

const leerRaw = async (entrada) => {
  const { data, info } = await entrada.raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, c: info.channels };
};

const idx = (im, x, y) => (y * im.w + x) * im.c;

/** Compone "(SIGLA)" con los glifos de la propia foto. */
async function componerSigla(im, sigla) {
  const copia = Buffer.from(im.data);
  const img = { ...im, data: copia };
  const alto = TEXTO.y1 - TEXTO.y0 + 1;

  // 1. Recortar cada glifo que haga falta, ANTES de borrar nada
  const recortar = ([x0, x1]) => {
    const ancho = x1 - x0 + 1;
    const buf = Buffer.alloc(ancho * alto * im.c);
    for (let y = 0; y < alto; y++) {
      for (let x = 0; x < ancho; x++) {
        const o = idx(im, x0 + x, TEXTO.y0 + y);
        const d = (y * ancho + x) * im.c;
        for (let k = 0; k < im.c; k++) buf[d + k] = im.data[o + k];
      }
    }
    return { buf, ancho };
  };

  const secuencia = ['(', ...sigla.split(''), ')'];
  for (const g of secuencia) {
    if (!TEXTO.glifos[g]) {
      throw new Error(`La foto no tiene el glifo "${g}"; solo hay: ${Object.keys(TEXTO.glifos).join(' ')}`);
    }
  }
  const piezas = secuencia.map((g) => ({ g, ...recortar(TEXTO.glifos[g]) }));

  // 2. Borrar la franja interpolando el fondo limpio de arriba y de abajo:
  //    asi el parche sigue el degradado y no se nota el remiendo.
  for (let x = TEXTO.x0; x <= TEXTO.x1; x++) {
    const arriba = idx(im, x, TEXTO.yFondoArriba);
    const abajo = idx(im, x, TEXTO.yFondoAbajo);
    for (let y = TEXTO.y0; y <= TEXTO.y1; y++) {
      const t = (y - TEXTO.yFondoArriba) / (TEXTO.yFondoAbajo - TEXTO.yFondoArriba);
      const d = idx(img, x, y);
      for (let k = 0; k < im.c; k++) {
        img.data[d + k] = Math.round(im.data[arriba + k] * (1 - t) + im.data[abajo + k] * t);
      }
    }
  }

  // 3. Dibujar la secuencia centrada. Solo se copian los pixeles con tinta
  //    (mas claros que el fondo), con mezcla suave para conservar el antialias.
  const anchoTotal = piezas.reduce((s, p) => s + p.ancho, 0)
    + TEXTO.separacion * (piezas.length - 1);
  let cursor = Math.round(TEXTO.centro - anchoTotal / 2);

  for (const p of piezas) {
    for (let y = 0; y < alto; y++) {
      for (let x = 0; x < p.ancho; x++) {
        const s = (y * p.ancho + x) * im.c;
        const brillo = (p.buf[s] + p.buf[s + 1] + p.buf[s + 2]) / 3;
        if (brillo < 110) continue;
        const destX = cursor + x;
        if (destX < 0 || destX >= im.w) continue;
        const d = idx(img, destX, TEXTO.y0 + y);
        const a = Math.min(1, Math.max(0, (brillo - 110) / 60));
        for (let k = 0; k < im.c; k++) {
          img.data[d + k] = Math.round(img.data[d + k] * (1 - a) + p.buf[s + k] * a);
        }
      }
    }
    cursor += p.ancho + TEXTO.separacion;
  }

  return img;
}

async function main() {
  const original = await leerRaw(sharp(ORIGEN));
  console.log(`foto original: ${original.w}x${original.h} (ratio ${(original.w / original.h).toFixed(4)})`);

  const conTexto = SIGLA ? await componerSigla(original, SIGLA) : original;

  // Recorte lateral antes de componer
  const fotoPng = await sharp(conTexto.data, {
    raw: { width: conTexto.w, height: conTexto.h, channels: conTexto.c },
  })
    .extract({
      left: RECORTE_LATERAL,
      top: 0,
      width: conTexto.w - RECORTE_LATERAL * 2,
      height: conTexto.h,
    })
    .png()
    .toBuffer();
  const corregida = await leerRaw(sharp(fotoPng));

  // Lienzo con la proporcion de la hoja
  const W = corregida.w;
  const H = Math.round(W / RATIO_HOJA);
  const franjaArriba = Math.max(0, Math.round((H - corregida.h) / 2));
  const franjaAbajo = Math.max(0, H - corregida.h - franjaArriba);
  console.log(`recorte lateral: ${RECORTE_LATERAL}px por lado -> foto ${W}x${corregida.h}`);
  console.log(`lienzo: ${W}x${H} (ratio ${(W / H).toFixed(4)}) — franjas de espejo: ` +
    `${franjaArriba}px arriba / ${franjaAbajo}px abajo (${(franjaArriba / H * 100).toFixed(1)}% por lado)`);

  /* Las franjas que faltan arriba y abajo se rellenan reflejando la propia
     foto: el empalme es continuo por construccion y todo queda nitido. */
  await sharp(fotoPng)
    .extend({
      top: franjaArriba,
      bottom: franjaAbajo,
      left: 0,
      right: 0,
      extendWith: 'mirror',
    })
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .toFile(DESTINO);

  console.log(`guardada: ${path.relative(RAIZ, DESTINO)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
