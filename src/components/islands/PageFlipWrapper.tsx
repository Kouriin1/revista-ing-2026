import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore } from '@nanostores/react';
import { $sonidoActivo } from '@lib/store';
import { reproducirPaginaPasada } from '@lib/audio';

interface Props {
  children?: ReactNode;
}

/**
 * Modo Revista 3D: efecto de hoja física con StPageFlip.
 *
 * Estrategia:
 *  1. Render children invisibles, dentro de un contenedor pf-fuente.
 *  2. Tras montar, recoger todos los nodos hijos (atravesando astro-slot).
 *  3. Particionar el HTML serializado en bloques que quepan en una "página".
 *  4. Instanciar PageFlip sobre un contenedor pf-libro y pasarle las páginas.
 *  5. Limpiar al desmontar.
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
  // Detectar móvil: si el viewport es ≤ 768px usamos vista scrollable
  const [esMobil, setEsMobil] = useState(false);

  useEffect(() => {
    const check = () => setEsMobil(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Limpiamos la pagina de elementos que no sirvan para el libro 3D
  const obtenerNodosReales = (padre: HTMLElement): HTMLElement[] => {
    const hijos = Array.from(padre.children) as HTMLElement[];
    if (hijos.length === 1 && hijos[0].tagName.toLowerCase() === 'astro-island') {
      const nietos = Array.from(hijos[0].children) as HTMLElement[];
      const contenedor = nietos.find(n => n.tagName.toLowerCase() === 'astro-slot');
      if (contenedor) return Array.from(contenedor.children) as HTMLElement[];
    }
    return hijos;
  };

  // En celulares no usamos el libro 3D, solo mostramos las tarjetas hacia abajo
  const [nodosMobil, setNodosMobil] = useState<string[]>([]);

  useEffect(() => {
    if (!esMobil) return;
    const id = setTimeout(() => {
      const fuente = fuenteRef.current;
      if (!fuente) { setCargando(false); return; }
      const nodos = obtenerNodosReales(fuente);
      setNodosMobil(nodos.map(n => n.outerHTML));
      setCargando(false);
    }, 200);
    return () => clearTimeout(id);
  }, [esMobil]);

  // Si estamos en computadora, preparamos las paginas para el libro 3D
  useEffect(() => {
    if (esMobil) return; 
    // Le damos un momento a la computadora para que cargue todo el texto
    const id = setTimeout(() => {
      const fuente = fuenteRef.current;
      if (!fuente) return;
      
      const nodos = obtenerNodosReales(fuente);
      console.log(`[PageFlip] Encontrados ${nodos.length} nodos fuente`);

      if (nodos.length === 0) {
        setCargando(false);
        return;
      }

      const { alto: ALTO_PAGINA, ancho: ANCHO_PAGINA } = obtenerDimensionesCarta();
      
      const medidor = document.createElement('div');
      medidor.style.cssText = `
        position: absolute; visibility: hidden; pointer-events: none;
        width: ${ANCHO_PAGINA}px; padding: 40px 48px 56px;
        font-family: var(--font-serif); font-size: 11px; line-height: 1.5;
        box-sizing: border-box;
      `;
      document.body.appendChild(medidor);

      const bloques: string[] = [];
      let actual = '';
      const articuloPageMap: Record<string, number> = {};

      for (const nodo of nodos) {
        const html = nodo.outerHTML;
        
        const esEspecial = nodo.classList.contains('hoja-portada') || 
                           nodo.classList.contains('hoja-contraportada');
        if (esEspecial) {
          if (actual !== '') {
            bloques.push(actual);
            actual = '';
          }
          bloques.push(html);
          continue;
        }

        const esArticulo = nodo.classList.contains('hoja-articulo');
        if (esArticulo) {
          if (actual !== '') {
            bloques.push(actual);
            actual = '';
          }
          const articuloIdx = nodo.getAttribute('data-articulo-idx');
          if (articuloIdx !== null) {
            articuloPageMap[articuloIdx] = bloques.length + 1;
          }
          const subNodos = Array.from(nodo.children) as HTMLElement[];
          let subActual = '';
          
          const flatNodos: HTMLElement[] = [];
          for (const sub of subNodos) {
            if (sub.classList.contains('plantilla-a__cuerpo') || sub.classList.contains('cabecera-articulo')) {
              for (const inner of Array.from(sub.children) as HTMLElement[]) {
                flatNodos.push(inner);
              }
            } else {
              flatNodos.push(sub);
            }
          }

          for (let fi = 0; fi < flatNodos.length; fi++) {
            const inner = flatNodos[fi];
            const innerHtml = inner.outerHTML;
            const tag = inner.tagName?.toLowerCase() || '';
            const esHeading = tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4';

            medidor.innerHTML = subActual + innerHtml;
            const alto = medidor.scrollHeight;

            if (alto > ALTO_PAGINA && subActual !== '') {
              bloques.push(subActual);
              subActual = innerHtml;
            } else {
              if (esHeading && fi + 1 < flatNodos.length) {
                const nextHtml = flatNodos[fi + 1].outerHTML;
                medidor.innerHTML = subActual + innerHtml + nextHtml;
                const altoConSiguiente = medidor.scrollHeight;
                if (altoConSiguiente > ALTO_PAGINA && subActual !== '') {
                  bloques.push(subActual);
                  subActual = innerHtml;
                } else {
                  subActual += innerHtml;
                }
              } else {
                subActual += innerHtml;
              }
            }
          }
          if (subActual !== '') bloques.push(subActual);
          continue;
        }

        medidor.innerHTML = actual + html;
        const altoNuevo = medidor.scrollHeight;

        if (altoNuevo > ALTO_PAGINA && actual !== '') {
          bloques.push(actual);
          actual = html;
          medidor.innerHTML = html;
        } else {
          actual += html;
        }
      }
      if (actual !== '') bloques.push(actual);

      document.body.removeChild(medidor);

      const tempDiv = document.createElement('div');
      bloques.forEach((bloque, pageIdx) => {
        tempDiv.innerHTML = bloque;
        const artEl = tempDiv.querySelector('.hoja-articulo[data-articulo-idx]');
        if (artEl) {
          const idx = artEl.getAttribute('data-articulo-idx')!;
          if (!(idx in articuloPageMap)) {
            articuloPageMap[idx] = pageIdx + 1;
          }
        }
      });

      bloques.forEach((bloque, idx) => {
        if (bloque.includes('hoja-indice')) {
          tempDiv.innerHTML = bloque;
          tempDiv.querySelectorAll<HTMLElement>('.indice-item[data-articulo-idx]').forEach(item => {
            const artIdx = item.getAttribute('data-articulo-idx')!;
            const pagEl = item.querySelector('.indice-pag');
            if (pagEl && articuloPageMap[artIdx]) {
              pagEl.textContent = `p. ${articuloPageMap[artIdx]}`;
            }
          });
          bloques[idx] = tempDiv.innerHTML;
        }
      });

      console.log(`[PageFlip] Generadas ${bloques.length} páginas`, articuloPageMap);
      setPaginas(bloques);
      setTotalPaginas(bloques.length);
      setCargando(false);
    }, 300); 

    return () => clearTimeout(id);
  }, []);

  // Creacion de la animacion de libro 3D
  useEffect(() => {
    if (esMobil) return;
    if (cargando || !paginas.length || !libroRef.current) return;
    let cancelado = false;

    (async () => {
      const { PageFlip } = await import('page-flip');
      if (cancelado || !libroRef.current) return;

      const { ancho, alto } = obtenerDimensionesCarta();

      const pf = new PageFlip(libroRef.current, {
        width: ancho,
        height: alto,
        size: 'fixed' as any,
        minWidth: 300,
        maxWidth: 1200,
        minHeight: 400,
        maxHeight: 1600,
        maxShadowOpacity: 0.5,
        showCover: true,
        mobileScrollSupport: false,
        usePortrait: window.innerWidth < 900,
        flippingTime: 800,
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

  // Vista para telefonos: tarjetas hacia abajo
  if (esMobil) {
    return (
      <div className="pf-contenedor pf-contenedor--mobil">
        {/* Usamos esto para leer el texto en el fondo sin que se vea */}
        <div ref={fuenteRef} className="pf-fuente" aria-hidden="true">
          {children}
        </div>

        {cargando ? (
          <div className="pf-cargando" role="status">
            <span className="pf-spinner" aria-hidden="true" />
            <span>Preparando la revista…</span>
          </div>
        ) : (
          <div className="pf-mobil-scroll">
            {nodosMobil.map((html, i) => (
              <div
                key={i}
                className="pf-mobil-carta"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Vista para computadoras: Libro interactivo animado 3D
  return (
    <div className="pf-contenedor">
      {/* Usamos esto para leer el texto en el fondo sin que se vea */}
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
        {paginas.map((html, i) => {
          const isCover = i === 0 || i === paginas.length - 1;
          
          // Detectar si la página es solo una imagen (sin texto)
          let esPoster = false;
          let posterSrc = '';
          if (!isCover && typeof document !== 'undefined') {
            const temp = document.createElement('div');
            temp.innerHTML = html;
            const texto = (temp.textContent || '').trim();
            const imgs = temp.querySelectorAll('img');
            if (texto.length === 0 && imgs.length === 1) {
              esPoster = true;
              posterSrc = imgs[0].src || imgs[0].getAttribute('src') || '';
            }
          }

          return (
            <div
              className={`pf-hoja ${isCover ? 'pf-hoja--hard' : ''}`}
              key={i}
              data-density={isCover ? 'hard' : 'soft'}
            >
              {esPoster ? (
                /* Imagen de página completa: posición absoluta, cubre toda la hoja */
                <img
                  src={posterSrc}
                  alt=""
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center',
                    display: 'block',
                    margin: 0,
                    padding: 0,
                    borderRadius: 0,
                    boxShadow: 'none',
                    zIndex: 10,
                  }}
                />
              ) : (
                <div className="pf-hoja__inner">
                  <div
                    className="pf-hoja__contenido"
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                  {!isCover && (
                    <div className="pf-hoja__pie">
                      <span>
                        Página {i} de {paginas.length - 2}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
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

const obtenerDimensionesCarta = () => {
  if (typeof window === 'undefined') return { ancho: 612, alto: 792 };
  
  const w = window.innerWidth;
  const h = window.innerHeight;
  
  // Espacio máximo disponible
  const maxHeight = Math.min(h - 120, 1000); 
  // En pantallas anchas se ven 2 páginas, en móviles 1
  const maxWidth = w < 900 ? w - 40 : (w / 2) - 80; 
  
  // Proporción exacta de Tamaño Carta (8.5 / 11)
  const RATIO = 8.5 / 11;
  
  let alto = maxHeight;
  let ancho = alto * RATIO;
  
  // Si el ancho calculado supera el espacio disponible, reescalamos por el ancho
  if (ancho > maxWidth) {
    ancho = maxWidth;
    alto = ancho / RATIO;
  }
  
  return { ancho, alto };
};
