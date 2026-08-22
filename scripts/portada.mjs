/**
 * Genera la portada compuesta a partir de la foto original.
 *
 *  Recompone la foto a la proporcion de la hoja (8.5/11). La foto es mas
 *     ancha de lo que pide la hoja, asi que hay que anadir alto: se rellena
 *     con la misma foto ampliada y desenfocada, y el empalme se difumina para
 *     que no se vea el borde.
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

/* La portada dice "(CEFIA)", que es la sigla correcta del centro. En un
   momento se pidio cambiarla por "(FIA)" y este script sabe hacerlo
   reutilizando los glifos de la propia imagen; se deja desactivado. */
const CAMBIAR_CEFIA_POR_FIA = false;

/* Medidas del texto, obtenidas midiendo la imagen (perfil de columnas):
   "(CEFIA)" = "(" 472-474 · "C" 478-489 · "E" 492-500 · "F" 504-512
               · "I" 516-517 · "A" 521-533 · ")" 536-539
   El renglon de arriba acaba en y=212 y el texto ocupa y=224..242. */
const TXT = {
  x0: 468, x1: 543,        // franja a limpiar (con margen)
  y0: 221, y1: 246,
  yFondoArriba: 219,       // filas limpias para interpolar el fondo
  yFondoAbajo: 248,
  parenIzq: { desde: 470, hasta: 476, tinta0: 472, tinta1: 474 },
  resto: { desde: 502, hasta: 541, tinta0: 504, tinta1: 539 }, // "FIA)"
  centro: 505.5,           // el texto va centrado aqui
  separacion: 3,           // px de aire entre "(" y "F", como en el original
};

const leerRaw = async (entrada) => {
  const { data, info } = await entrada.raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, c: info.channels };
};

const idx = (im, x, y) => (y * im.w + x) * im.c;

async function corregirTexto(im) {
  const copia = Buffer.from(im.data);
  const img = { ...im, data: copia };

  // 1. Guardar los glifos que se reutilizan, ANTES de borrar nada
  const recortar = (x0, x1) => {
    const ancho = x1 - x0 + 1;
    const alto = TXT.y1 - TXT.y0 + 1;
    const buf = Buffer.alloc(ancho * alto * im.c);
    for (let y = 0; y < alto; y++) {
      for (let x = 0; x < ancho; x++) {
        const o = idx(im, x0 + x, TXT.y0 + y);
        const d = (y * ancho + x) * im.c;
        for (let k = 0; k < im.c; k++) buf[d + k] = im.data[o + k];
      }
    }
    return { buf, ancho, alto };
  };
  const paren = recortar(TXT.parenIzq.desde, TXT.parenIzq.hasta);
  const resto = recortar(TXT.resto.desde, TXT.resto.hasta);

  // 2. Borrar la franja interpolando verticalmente el fondo limpio de arriba y
  //    de abajo: asi el parche sigue el degradado y no se nota el remiendo.
  for (let x = TXT.x0; x <= TXT.x1; x++) {
    const arriba = idx(im, x, TXT.yFondoArriba);
    const abajo = idx(im, x, TXT.yFondoAbajo);
    for (let y = TXT.y0; y <= TXT.y1; y++) {
      const t = (y - TXT.yFondoArriba) / (TXT.yFondoAbajo - TXT.yFondoArriba);
      const d = idx(img, x, y);
      for (let k = 0; k < im.c; k++) {
        img.data[d + k] = Math.round(im.data[arriba + k] * (1 - t) + im.data[abajo + k] * t);
      }
    }
  }

  // 3. Recolocar "(" y "FIA)" centrados, pegados como en el original.
  //    Solo se copian los pixeles con tinta (mas claros que el fondo), para no
  //    arrastrar el fondo viejo del recorte.
  const anchoTinta = (TXT.parenIzq.tinta1 - TXT.parenIzq.tinta0 + 1)
    + TXT.separacion
    + (TXT.resto.tinta1 - TXT.resto.tinta0 + 1);
  const tintaIzq = Math.round(TXT.centro - anchoTinta / 2);

  const pegar = (rec, tinta0, destinoTinta) => {
    const desplaz = destinoTinta - tinta0;
    for (let y = 0; y < rec.alto; y++) {
      for (let x = 0; x < rec.ancho; x++) {
        const s = (y * rec.ancho + x) * im.c;
        const brillo = (rec.buf[s] + rec.buf[s + 1] + rec.buf[s + 2]) / 3;
        if (brillo < 110) continue; // fondo: no se copia
        const destX = TXT[rec === paren ? 'parenIzq' : 'resto'].desde + x + desplaz;
        if (destX < 0 || destX >= im.w) continue;
        const d = idx(img, destX, TXT.y0 + y);
        // Mezcla suave para conservar el antialias del borde de las letras
        const a = Math.min(1, Math.max(0, (brillo - 110) / 60));
        for (let k = 0; k < im.c; k++) {
          img.data[d + k] = Math.round(img.data[d + k] * (1 - a) + rec.buf[s + k] * a);
        }
      }
    }
  };
  pegar(paren, TXT.parenIzq.tinta0, tintaIzq);
  pegar(resto, TXT.resto.tinta0, tintaIzq + (TXT.parenIzq.tinta1 - TXT.parenIzq.tinta0 + 1) + TXT.separacion);

  return img;
}

async function main() {
  const original = await leerRaw(sharp(ORIGEN));
  console.log(`foto original: ${original.w}x${original.h} (ratio ${(original.w / original.h).toFixed(4)})`);

  const conTexto = CAMBIAR_CEFIA_POR_FIA ? await corregirTexto(original) : original;

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
  const yFoto = Math.round((H - corregida.h) / 2);
  console.log(`recorte lateral: ${RECORTE_LATERAL}px por lado -> foto ${W}x${corregida.h}`);
  console.log(`lienzo: ${W}x${H} (ratio ${(W / H).toFixed(4)}) — la foto va en y=${yFoto} ` +
    `(franja inventada: ${yFoto}px = ${(yFoto / H * 100).toFixed(1)}% por lado)`);

  // Fondo: la misma foto ampliada a cubrir el lienzo y desenfocada
  const fondo = await leerRaw(
    sharp(fotoPng).resize(W, H, { fit: 'cover', position: 'center' }).blur(18),
  );

  /* Mezcla con los bordes de la foto difuminados hacia el fondo. El
     difuminado se ajusta a lo que haya que inventar: con una franja pequena no
     tiene sentido emborronar 70px de foto buena. */
  const DIFUMINADO = Math.max(18, Math.min(60, Math.round(yFoto * 1.4)));
  const salida = Buffer.from(fondo.data);
  for (let y = 0; y < corregida.h; y++) {
    const yl = yFoto + y;
    if (yl < 0 || yl >= H) continue;
    let a = 1;
    if (y < DIFUMINADO) a = y / DIFUMINADO;
    else if (y > corregida.h - DIFUMINADO) a = (corregida.h - y) / DIFUMINADO;
    a = a * a * (3 - 2 * a); // suavizado
    for (let x = 0; x < W; x++) {
      const s = idx(corregida, x, y);
      const d = (yl * W + x) * fondo.c;
      for (let k = 0; k < 3; k++) {
        salida[d + k] = Math.round(fondo.data[d + k] * (1 - a) + corregida.data[s + k] * a);
      }
    }
  }

  await sharp(salida, { raw: { width: W, height: H, channels: fondo.c } })
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .toFile(DESTINO);

  console.log(`guardada: ${path.relative(RAIZ, DESTINO)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
