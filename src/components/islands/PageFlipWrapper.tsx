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

  /* Cambia al redimensionar: obliga a recalcular las hojas, porque el tamaño
     de pagina depende del viewport y una paginacion vieja se corta. */
  const [claveTamano, setClaveTamano] = useState(0);

  useEffect(() => {
    const check = () => setEsMobil(window.innerWidth <= 768);
    check();
    let temporizador: ReturnType<typeof setTimeout>;
    const alRedimensionar = () => {
      check();
      clearTimeout(temporizador);
      temporizador = setTimeout(() => setClaveTamano((k) => k + 1), 400);
    };
    window.addEventListener('resize', alRedimensionar);
    return () => {
      window.removeEventListener('resize', alRedimensionar);
      clearTimeout(temporizador);
    };
  }, []);

  // Limpiamos la pagina de elementos que no sirvan para el libro 3D
  const obtenerNodosReales = (padre: HTMLElement): HTMLElement[] => {
    const hijos = Array.from(padre.children) as HTMLElement[];

    // Caso 1: astro-island envuelve todo (comportamiento antiguo)
    if (hijos.length === 1 && hijos[0].tagName.toLowerCase() === 'astro-island') {
      const nietos = Array.from(hijos[0].children) as HTMLElement[];
      const contenedor = nietos.find(n => n.tagName.toLowerCase() === 'astro-slot');
      if (contenedor) return Array.from(contenedor.children) as HTMLElement[];
    }

    // Caso 2: astro-slot es hijo directo (client:only en Astro moderno)
    if (hijos.length === 1 && hijos[0].tagName.toLowerCase() === 'astro-slot') {
      return Array.from(hijos[0].children) as HTMLElement[];
    }

    // Caso 3: varios hijos, pero algunos son astro-slot — aplanar
    const resultado: HTMLElement[] = [];
    for (const hijo of hijos) {
      if (hijo.tagName.toLowerCase() === 'astro-slot') {
        resultado.push(...Array.from(hijo.children) as HTMLElement[]);
      } else {
        resultado.push(hijo);
      }
    }
    return resultado;
  };

  /** Quita envoltorios sin contenido propio (#contenido-revista en /articulo/*). */
  const desenvolver = (nodos: HTMLElement[]): HTMLElement[] =>
    nodos.flatMap((n) =>
      n.id === 'contenido-revista' || (n.children.length === 1 && n.tagName.toLowerCase() === 'div' && !n.className)
        ? (Array.from(n.children) as HTMLElement[])
        : [n],
    );


  // En celulares no usamos el libro 3D, solo mostramos las tarjetas hacia abajo
  const [nodosMobil, setNodosMobil] = useState<string[]>([]);

  useEffect(() => {
    if (!esMobil) return;
    const id = setTimeout(() => {
      const fuente = fuenteRef.current;
      if (!fuente) { setCargando(false); return; }
      const nodos = desenvolver(obtenerNodosReales(fuente));
      setNodosMobil(nodos.map(n => n.outerHTML));
      setCargando(false);
    }, 600); // Aumentado: con 10+ artículos el DOM tarda más en hidratarse
    return () => clearTimeout(id);
  }, [esMobil]);

  // Si estamos en computadora, preparamos las paginas para el libro 3D
  useEffect(() => {
    if (esMobil) return;
    let cancelado = false;

    /* Hay que esperar a que las tipografias esten listas: si se mide con la
       fuente de reserva, el texto crece al aplicarse la definitiva y algunas
       hojas terminan desbordadas. */
    const paginar = async () => {
      if (cancelado) return;
      const fuente = fuenteRef.current;
      if (!fuente) return;
      
      const nodos = desenvolver(obtenerNodosReales(fuente));
      console.log(`[PageFlip] Encontrados ${nodos.length} nodos fuente`);

      if (nodos.length === 0) {
        setCargando(false);
        return;
      }

      const { alto: ALTO_PAGINA, ancho: ANCHO_PAGINA } = obtenerDimensionesCarta();

      /* Medidor REAL: replica exacta de una hoja (.pf-hoja > .pf-hoja__inner >
         .pf-hoja__contenido) para que el CSS del libro se aplique tal cual.
         Antes se medía con estilos inline (11px) muy distintos a los reales
         (~15px), y por eso se metía más texto del que cabía y se cortaba. */
      const medidorHoja = document.createElement('div');
      medidorHoja.className = 'pf-hoja';
      medidorHoja.setAttribute('aria-hidden', 'true');
      medidorHoja.style.cssText = `
        position: absolute; left: -99999px; top: 0;
        width: ${ANCHO_PAGINA}px; height: ${ALTO_PAGINA}px;
        visibility: hidden; pointer-events: none; z-index: -1;
      `;
      const medidorInner = document.createElement('div');
      medidorInner.className = 'pf-hoja__inner';
      const medidor = document.createElement('div');
      medidor.className = 'pf-hoja__contenido';
      medidorInner.appendChild(medidor);
      medidorHoja.appendChild(medidorInner);
      document.body.appendChild(medidorHoja);

      /* Con el medidor ya en el DOM y con contenido real dentro, el navegador
         solicita las tipografias del libro. Solo entonces tiene sentido esperar
         a document.fonts.ready: si esperamos antes, la serif aun no se ha
         pedido, resuelve de inmediato y medimos con la fuente de reserva
         (que es mas baja), metiendo mas texto del que cabe. */
      medidor.innerHTML = nodos.map((n) => n.outerHTML).join('');
      /* Leer una propiedad de layout fuerza el reflow: sin esto el navegador
         no llega a solicitar las tipografias y fonts.ready resuelve en vano. */
      void medidor.scrollHeight;
      await (document as any).fonts?.ready;
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      medidor.innerHTML = '';
      if (cancelado) {
        medidorHoja.remove();
        return;
      }

      /* Altura util real de la caja de contenido (ya descuenta padding y el
         espacio reservado para el folio). */
      const ALTO_UTIL = medidor.clientHeight || ALTO_PAGINA - 100;

      /** ¿Este HTML cabe entero en una hoja? */
      const cabe = (html: string): boolean => {
        medidor.innerHTML = html;
        return medidor.scrollHeight <= ALTO_UTIL;
      };


      const escaparTexto = (t: string) =>
        t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      /**
       * Reparte el contenido en línea de un elemento (un párrafo largo, un ítem
       * de lista…) entre varias copias del mismo elemento, cortando por
       * palabras. Es el último recurso: en hojas bajas hay párrafos que no
       * caben enteros y sin esto se recortarían.
       * Los elementos en línea (negritas, cursivas, enlaces) se mantienen
       * intactos como una sola pieza.
       */
      const partirPorTexto = (el: HTMLElement): string[] => {
        const piezas: string[] = [];
        el.childNodes.forEach((n) => {
          if (n.nodeType === 3) {
            (n.textContent || '')
              .split(/(\s+)/)
              .filter((s) => s !== '')
              .forEach((p) => piezas.push(escaparTexto(p)));
          } else if (n.nodeType === 1) {
            piezas.push((n as HTMLElement).outerHTML);
          }
        });
        if (piezas.length < 2) return [el.outerHTML];

        const armar = (desde: number, hasta: number) => {
          const clon = el.cloneNode(false) as HTMLElement;
          clon.innerHTML = piezas.slice(desde, hasta).join('');
          return clon.outerHTML;
        };

        const trozos: string[] = [];
        let desde = 0;
        while (desde < piezas.length) {
          /* Busqueda binaria del mayor corte que todavia cabe: evita medir
             palabra por palabra, que seria lentisimo. */
          let bajo = desde + 1;
          let alto = piezas.length;
          let mejor = desde + 1;
          while (bajo <= alto) {
            const medio = Math.floor((bajo + alto) / 2);
            if (cabe(armar(desde, medio))) {
              mejor = medio;
              bajo = medio + 1;
            } else {
              alto = medio - 1;
            }
          }
          trozos.push(armar(desde, mejor));
          desde = mejor;
        }
        return trozos.length ? trozos : [el.outerHTML];
      };

      /**
       * Parte un elemento que por sí solo no cabe en una hoja.
       * Tablas -> por filas (repitiendo encabezado y titulo); listas -> por ítems;
       * contenedores -> por sus hijos (recursivo); y como último recurso,
       * el propio texto se reparte por palabras.
       */
      const dividirNodo = (el: HTMLElement, profundidad = 0): string[] => {
        const tabla = el.matches('figure.tabla-academica')
          ? el.querySelector('table')
          : el.tagName.toLowerCase() === 'table'
            ? (el as HTMLTableElement)
            : null;

        if (tabla) {
          const filas = Array.from(tabla.querySelectorAll('tbody > tr'));
          if (filas.length < 2) return [el.outerHTML];

          const trozos: string[] = [];
          let molde = el.cloneNode(true) as HTMLElement;
          let cuerpo = molde.querySelector('tbody')!;
          cuerpo.innerHTML = '';
          let puestas = 0;

          const nuevoMolde = () => {
            const m = el.cloneNode(true) as HTMLElement;
            m.classList.add('tabla-academica--cont');
            m.querySelector('tbody')!.innerHTML = '';
            /* La nota al pie solo va en el ultimo trozo */
            m.querySelector('.tabla-academica__nota')?.remove();
            return m;
          };

          for (const fila of filas) {
            cuerpo.appendChild(fila.cloneNode(true));
            puestas++;
            if (!cabe(molde.outerHTML) && puestas > 1) {
              cuerpo.removeChild(cuerpo.lastChild!);
              trozos.push(molde.outerHTML);
              molde = nuevoMolde();
              cuerpo = molde.querySelector('tbody')!;
              cuerpo.appendChild(fila.cloneNode(true));
              puestas = 1;
            }
          }
          if (puestas > 0) trozos.push(molde.outerHTML);
          return trozos.length ? trozos : [el.outerHTML];
        }

        const tag = el.tagName.toLowerCase();
        if (tag === 'ul' || tag === 'ol') {
          const items = Array.from(el.children) as HTMLElement[];
          if (items.length === 0) return partirPorTexto(el);

          const trozos: string[] = [];
          let molde = el.cloneNode(false) as HTMLElement;
          let puestos = 0;
          const cerrar = () => {
            if (puestos > 0) trozos.push(molde.outerHTML);
            molde = el.cloneNode(false) as HTMLElement;
            puestos = 0;
          };

          for (const item of items) {
            /* Un item que ni siquiera cabe solo: se reparte su texto y cada
               pedazo viaja dentro de su propia copia de la lista. */
            const soloItem = el.cloneNode(false) as HTMLElement;
            soloItem.appendChild(item.cloneNode(true));
            if (!cabe(soloItem.outerHTML)) {
              cerrar();
              for (const pedazo of partirPorTexto(item)) {
                const envoltorio = el.cloneNode(false) as HTMLElement;
                envoltorio.innerHTML = pedazo;
                trozos.push(envoltorio.outerHTML);
              }
              continue;
            }

            molde.appendChild(item.cloneNode(true));
            puestos++;
            if (!cabe(molde.outerHTML) && puestos > 1) {
              molde.removeChild(molde.lastChild!);
              trozos.push(molde.outerHTML);
              molde = el.cloneNode(false) as HTMLElement;
              molde.appendChild(item.cloneNode(true));
              puestos = 1;
            }
          }
          cerrar();
          return trozos.length ? trozos : [el.outerHTML];
        }

        /* ¿Es un elemento con texto propio (un párrafo con negritas dentro) o
           un simple contenedor? En el primer caso NO se puede repartir por
           hijos: se perderían los nodos de texto sueltos. */
        const tieneTextoPropio = Array.from(el.childNodes).some(
          (n) => n.nodeType === 3 && (n.textContent || '').trim() !== '',
        );
        if (tieneTextoPropio) return partirPorTexto(el);

        /* Contenedor genérico (el <article> de la ruta de artículo, la hoja de
           índice…): lo repartimos por sus hijos en vez de dejar que se corte. */
        const hijos = Array.from(el.children) as HTMLElement[];
        if (profundidad < 6 && hijos.length >= 1) {
          const trozos: string[] = [];
          let buffer = '';
          for (const hijo of hijos) {
            const hijoHtml = hijo.outerHTML;
            if (!cabe(hijoHtml)) {
              if (buffer !== '') {
                trozos.push(buffer);
                buffer = '';
              }
              const sub = dividirNodo(hijo, profundidad + 1);
              for (let si = 0; si < sub.length; si++) {
                if (si === sub.length - 1) buffer = sub[si];
                else trozos.push(sub[si]);
              }
              continue;
            }
            if (!cabe(buffer + hijoHtml) && buffer !== '') {
              trozos.push(buffer);
              buffer = hijoHtml;
            } else {
              buffer += hijoHtml;
            }
          }
          if (buffer !== '') trozos.push(buffer);
          if (trozos.length > 1) return trozos;
          /* Aunque quede un solo trozo, quitar el envoltorio puede haber
             bastado para que quepa: hay que quedarse con el, no con el
             elemento original que sabemos que desborda. */
          if (trozos.length === 1 && cabe(trozos[0])) return trozos;
        }

        /* Ya no hay estructura que partir: repartimos el texto por palabras. */
        return partirPorTexto(el);
      };

      const bloques: string[] = [];
      let actual = '';
      const articuloPageMap: Record<string, number> = {};

      for (const nodo of nodos) {
        const html = nodo.outerHTML;
        
        const esEspecial = nodo.classList.contains('hoja-portada') ||
                           nodo.classList.contains('hoja-contraportada') ||
                           nodo.classList.contains('hoja-creditos') ||
                           nodo.classList.contains('hoja-indice');
        if (esEspecial) {
          if (actual !== '') {
            bloques.push(actual);
            actual = '';
          }
          /* Portada y contraportada son a sangre: van enteras siempre. El
             indice y los creditos si deben repartirse cuando la hoja es baja,
             o se cortarian por abajo. */
          const aSangre = nodo.classList.contains('hoja-portada') ||
                          nodo.classList.contains('hoja-contraportada');
          if (aSangre || cabe(html)) bloques.push(html);
          else bloques.push(...dividirNodo(nodo));
          continue;
        }

        /* .plantilla-a es el envoltorio de la ruta /articulo/*, .hoja-articulo el
           de la portada-libro: ambos se paginan igual (aplanando cabecera y cuerpo). */
        const esArticulo = nodo.classList.contains('hoja-articulo') ||
                           nodo.classList.contains('plantilla-a');
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
            /* La banda de metadatos y el pie de navegacion se ocultan por CSS
               dentro del libro: no deben ocupar sitio en la paginacion. */
            if (sub.classList.contains('banda-meta') || sub.classList.contains('articulo-footer')) {
              continue;
            }
            if (sub.classList.contains('plantilla-a__cuerpo') ||
                sub.classList.contains('cabecera-articulo') ||
                sub.classList.contains('referencias-seccion')) {
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

            /* El elemento no cabe ni en una hoja vacia: hay que partirlo
               (tabla por filas, lista por items) en vez de dejar que se corte. */
            if (!cabe(innerHtml)) {
              if (subActual !== '') {
                bloques.push(subActual);
                subActual = '';
              }
              const trozos = dividirNodo(inner);
              for (let ti = 0; ti < trozos.length; ti++) {
                if (ti === trozos.length - 1) subActual = trozos[ti];
                else bloques.push(trozos[ti]);
              }
              continue;
            }

            if (!cabe(subActual + innerHtml) && subActual !== '') {
              bloques.push(subActual);
              subActual = innerHtml;
              continue;
            }

            /* Un titulo nunca debe quedar solo al pie de una hoja: si el
               elemento que le sigue no entra, lo pasamos junto con el. */
            if (esHeading && fi + 1 < flatNodos.length && subActual !== '') {
              const nextHtml = flatNodos[fi + 1].outerHTML;
              if (!cabe(subActual + innerHtml + nextHtml) && cabe(innerHtml + nextHtml)) {
                bloques.push(subActual);
                subActual = innerHtml;
                continue;
              }
            }

            subActual += innerHtml;
          }
          if (subActual !== '') bloques.push(subActual);
          continue;
        }

        if (!cabe(html)) {
          if (actual !== '') {
            bloques.push(actual);
            actual = '';
          }
          const trozos = dividirNodo(nodo);
          for (let ti = 0; ti < trozos.length; ti++) {
            if (ti === trozos.length - 1) actual = trozos[ti];
            else bloques.push(trozos[ti]);
          }
          continue;
        }

        if (!cabe(actual + html) && actual !== '') {
          bloques.push(actual);
          actual = html;
        } else {
          actual += html;
        }
      }
      if (actual !== '') bloques.push(actual);

      /* Red de seguridad: ninguna hoja debe quedar desbordada. Si alguna se
         pasa (por un elemento que no supimos partir antes), la repartimos por
         sus hijos de primer nivel hasta que entre. */
      const validados: string[] = [];
      const caja = document.createElement('div');
      for (const bloque of bloques) {
        if (cabe(bloque)) {
          validados.push(bloque);
          continue;
        }
        caja.innerHTML = bloque;
        const piezas = Array.from(caja.children) as HTMLElement[];
        if (piezas.length === 0) {
          validados.push(bloque);
          continue;
        }
        let buffer = '';
        for (const pieza of piezas) {
          const piezaHtml = pieza.outerHTML;
          if (!cabe(piezaHtml)) {
            if (buffer !== '') { validados.push(buffer); buffer = ''; }
            const sub = dividirNodo(pieza);
            for (let si = 0; si < sub.length; si++) {
              if (si === sub.length - 1) buffer = sub[si];
              else validados.push(sub[si]);
            }
            continue;
          }
          if (!cabe(buffer + piezaHtml) && buffer !== '') {
            validados.push(buffer);
            buffer = piezaHtml;
          } else {
            buffer += piezaHtml;
          }
        }
        if (buffer !== '') validados.push(buffer);
      }
      bloques.length = 0;
      bloques.push(...validados);

      document.body.removeChild(medidorHoja);

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
        /* Se busca por 'indice-item': cuando la hoja de indice se reparte en
           varias, los trozos ya no llevan la clase 'hoja-indice' y los folios
           se quedaban sin resolver. */
        if (bloque.includes('indice-item')) {
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
    };

    /* Margen para que Astro termine de hidratar el contenido del slot. */
    const id = setTimeout(paginar, 600);

    return () => {
      cancelado = true;
      clearTimeout(id);
    };
  }, [claveTamano, esMobil]);

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
