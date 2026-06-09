import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore } from '@nanostores/react';
import { $sonidoActivo } from '@lib/store';
import { reproducirPaginaPasada } from '@lib/audio';

interface Props {
  children?: ReactNode;
}

/**
 * Modo Revista: efecto de hoja física con StPageFlip.
 *
 * Estrategia:
 *  1. Render children invisibles, dentro de un contenedor #pf-fuente.
 *  2. Tras montar, particionar el HTML serializado en bloques que quepan
 *     en una "página" (~720px de alto, configurable).
 *  3. Instanciar PageFlip sobre un contenedor #pf-libro y pasarle las páginas.
 *  4. Limpiar al desmontar.
 *
 * Importamos page-flip via dynamic import para evitar SSR (toca window).
 */
export default function PageFlipWrapper({ children }: Props) {
  const fuenteRef = useRef<HTMLDivElement>(null);
  const libroRef = useRef<HTMLDivElement>(null);
  const instanciaRef = useRef<any>(null);
  const sonidoActivo = useStore($sonidoActivo);
  const sonidoRef = useRef(sonidoActivo);
  sonidoRef.current = sonidoActivo;

  const [paginas, setPaginas] = useState<string[]>([]);
  const [paginaActual, setPaginaActual] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [cargando, setCargando] = useState(true);

  /* ------- Paginación ------- */
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const fuente = fuenteRef.current;
      if (!fuente) return;
      const nodos = Array.from(fuente.children);
      if (nodos.length === 0) {
        setCargando(false);
        return;
      }

      const ALTO_PAGINA = obtenerAltoPagina();
      const medidor = document.createElement('div');
      medidor.style.cssText = `
        position: absolute; visibility: hidden; pointer-events: none;
        width: ${obtenerAnchoPagina()}px; padding: 48px 40px;
        font-family: var(--font-serif); font-size: 16px; line-height: 1.7;
        box-sizing: border-box;
      `;
      document.body.appendChild(medidor);

      const bloques: string[] = [];
      let actual = '';
      let altoActual = 0;

      for (const nodo of nodos) {
        const html = (nodo as HTMLElement).outerHTML;
        medidor.innerHTML = actual + html;
        const altoNuevo = medidor.scrollHeight;

        if (altoNuevo > ALTO_PAGINA && actual !== '') {
          bloques.push(actual);
          actual = html;
          medidor.innerHTML = html;
          altoActual = medidor.scrollHeight;
        } else {
          actual += html;
          altoActual = altoNuevo;
        }

        if (altoActual > ALTO_PAGINA * 1.5) {
          // Bloque individual gigantesco (imagen, tabla) — déjalo solo
          bloques.push(actual);
          actual = '';
          altoActual = 0;
        }
      }
      if (actual !== '') bloques.push(actual);

      document.body.removeChild(medidor);
      setPaginas(bloques);
      setTotalPaginas(bloques.length);
      setCargando(false);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  /* ------- Instanciar StPageFlip ------- */
  useEffect(() => {
    if (paginas.length === 0) return;
    let cancelado = false;

    (async () => {
      const { PageFlip } = await import('page-flip');
      if (cancelado || !libroRef.current) return;

      const ancho = obtenerAnchoPagina();
      const alto = obtenerAltoPagina();

      const pf = new PageFlip(libroRef.current, {
        width: ancho,
        height: alto,
        size: 'stretch' as any,
        minWidth: 280,
        maxWidth: 1000,
        minHeight: 400,
        maxHeight: 1400,
        maxShadowOpacity: 0.5,
        showCover: false,
        mobileScrollSupport: false,
        usePortrait: window.innerWidth < 900,
        flippingTime: 700,
        drawShadow: true,
        showPageCorners: true,
        disableFlipByClick: false,
        autoSize: true,
        startPage: 0,
        startZIndex: 0,
        swipeDistance: 30,
        clickEventForward: true,
      });

      pf.loadFromHTML(libroRef.current.querySelectorAll('.pf-hoja'));
      pf.on('flip', (e: any) => {
        setPaginaActual(e.data as number);
        reproducirPaginaPasada(sonidoRef.current);
      });

      instanciaRef.current = pf;
    })();

    return () => {
      cancelado = true;
      try {
        instanciaRef.current?.destroy?.();
      } catch {}
      instanciaRef.current = null;
    };
  }, [paginas]);

  const anterior = () => instanciaRef.current?.flipPrev?.();
  const siguiente = () => instanciaRef.current?.flipNext?.();

  return (
    <div className="pf-contenedor">
      {/* Fuente original — invisible, solo para paginar */}
      <div ref={fuenteRef} className="pf-fuente" aria-hidden="true">
        {children}
      </div>

      {cargando && (
        <div className="pf-cargando" role="status">
          <span className="pf-spinner" aria-hidden="true" />
          <span>Preparando la revista…</span>
        </div>
      )}

      <div ref={libroRef} className="pf-libro" aria-label="Revista con páginas">
        {paginas.map((html, i) => (
          <div className="pf-hoja" key={i}>
            <div className="pf-hoja__inner">
              <div className="pf-hoja__contenido" dangerouslySetInnerHTML={{ __html: html }} />
              <div className="pf-hoja__pie">
                <span>Página {i + 1} de {paginas.length}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {paginas.length > 0 && (
        <div className="pf-controles" role="group" aria-label="Navegación de páginas">
          <button type="button" onClick={anterior} aria-label="Página anterior" className="pf-nav">
            ‹ Anterior
          </button>
          <span className="pf-indicador">
            {paginaActual + 1} / {totalPaginas}
          </span>
          <button type="button" onClick={siguiente} aria-label="Página siguiente" className="pf-nav">
            Siguiente ›
          </button>
        </div>
      )}
    </div>
  );
}

const obtenerAnchoPagina = (): number => {
  if (typeof window === 'undefined') return 400;
  const w = window.innerWidth;
  if (w < 600) return Math.min(w - 32, 500);
  if (w < 1200) return 480;
  return 540;
};
const obtenerAltoPagina = (): number => {
  if (typeof window === 'undefined') return 600;
  const h = window.innerHeight;
  return Math.min(h - 180, 880);
};
