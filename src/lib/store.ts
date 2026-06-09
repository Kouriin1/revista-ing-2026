import { atom, computed } from 'nanostores';

/* =========================================================================
   ESTADO GLOBAL — preferencias de lectura
   Persistido en localStorage. Compartido entre islands.
   ========================================================================= */

type Tema = 'auto' | 'claro' | 'oscuro';
type ModoLectura = 'auto' | 'scroll' | 'revista';

const SK = {
  tema: 'rev:tema',
  fuente: 'rev:fuente',
  modo: 'rev:modo',
  sonido: 'rev:sonido',
} as const;

const leer = <T extends string>(k: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  return (localStorage.getItem(k) as T) ?? fallback;
};
const leerNum = (k: string, fallback: number): number => {
  if (typeof window === 'undefined') return fallback;
  const v = Number(localStorage.getItem(k));
  return Number.isFinite(v) && v > 0 ? v : fallback;
};
const leerBool = (k: string, fallback: boolean): boolean => {
  if (typeof window === 'undefined') return fallback;
  const v = localStorage.getItem(k);
  return v === null ? fallback : v === 'true';
};

export const $tema = atom<Tema>(leer<Tema>(SK.tema, 'auto'));
export const $escalaFuente = atom<number>(leerNum(SK.fuente, 1));
export const $modoLectura = atom<ModoLectura>(leer<ModoLectura>(SK.modo, 'auto'));
export const $sonidoActivo = atom<boolean>(leerBool(SK.sonido, true));

if (typeof window !== 'undefined') {
  $tema.subscribe((v) => {
    localStorage.setItem(SK.tema, v);
    if (v === 'auto') document.documentElement.removeAttribute('data-tema');
    else document.documentElement.setAttribute('data-tema', v);
  });
  $escalaFuente.subscribe((v) => {
    localStorage.setItem(SK.fuente, String(v));
    document.documentElement.style.setProperty('--fs-scale', String(v));
  });
  $modoLectura.subscribe((v) => {
    localStorage.setItem(SK.modo, v);
    document.documentElement.setAttribute('data-modo', v);
  });
  $sonidoActivo.subscribe((v) => localStorage.setItem(SK.sonido, String(v)));
}

export const $modoEfectivo = computed($modoLectura, (modo) => {
  if (modo !== 'auto') return modo;
  if (typeof window === 'undefined') return 'scroll';
  const movil = window.matchMedia('(max-width: 900px)').matches;
  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return movil && !reducido ? 'revista' : 'scroll';
});
