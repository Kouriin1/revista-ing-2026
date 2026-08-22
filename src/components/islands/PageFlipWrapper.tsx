import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  /* Hojas que se justifican verticalmente (el texto termina abajo del todo). */
  const [ajustadas, setAjustadas] = useState<boolean[]>([]);
  const [paginaActual, setPaginaActual] = useState(0);
  /* Se guarda aparte porque al redimensionar hay que reconstruir el libro y no
     queremos devolver al lector a la portada. */
  const paginaActualRef = useRef(0);
  const [escala, setEscala] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [cargando, setCargando] = useState(true);
  // Detectar móvil: si el viewport es ≤ 768px usamos vista scrollable
  const [esMobil, setEsMobil] = useState(false);

  /* Cambia al redimensionar: obliga a recalcular las hojas, porque el tamaño
     de pagina depende del viewport y una paginacion vieja se corta. */
  const [claveTamano, setClaveTamano] = useState(0);

  /* El slot con la revista entera solo hace falta para leerla una vez. Se
     guarda su HTML y se desmonta: asi el navegador deja de mantener en vida un
     duplicado completo del contenido (con 7 articulos era la mitad del DOM). */
  const fuenteHtmlRef = useRef<string | null>(null);
  const [fuenteMontada, setFuenteMontada] = useState(true);

  useEffect(() => {
    const aplicar = () => {
      setEsMobil(window.innerWidth <= 768);
      setEscala(calcularEscala());
    };
    aplicar();
    let temporizador: ReturnType<typeof setTimeout>;
    const alRedimensionar = () => {
      /* Redimensionar ya no repagina (la hoja tiene medidas fijas), solo hay
         que recalcular la escala y rehacer el libro, asi que la espera puede
         ser corta. */
      clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        aplicar();
        setClaveTamano((k) => k + 1);
      }, 200);
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

  /**
   * Nodos de la revista. La primera vez se leen del slot en cuanto Astro
   * termina de hidratarlo (se comprueba por frame, en lugar de esperar un
   * tiempo fijo); despues se reconstruyen del HTML ya guardado, en un
   * contenedor suelto que no pesa en el documento.
   */
  const obtenerFuente = (): Promise<HTMLElement[]> => {
    if (fuenteHtmlRef.current !== null) {
      const caja = document.createElement('div');
      caja.innerHTML = fuenteHtmlRef.current;
      return Promise.resolve(Array.from(caja.children) as HTMLElement[]);
    }
    return new Promise((resolver) => {
      const limite = performance.now() + 5000;
      /* Se exige que el numero de nodos se repita dos fotogramas seguidos: asi
         no se captura el slot a medio poblar (era el motivo de la espera fija
         de 600 ms, que penalizaba a todo el mundo por un caso raro). */
      let anterior = -1;
      const mirar = () => {
        const fuente = fuenteRef.current;
        if (fuente) {
          const nodos = desenvolver(obtenerNodosReales(fuente));
          if (nodos.length > 0 && nodos.length === anterior) {
            fuenteHtmlRef.current = nodos.map((n) => n.outerHTML).join('');
            return resolver(nodos);
          }
          anterior = nodos.length;
        }
        if (performance.now() > limite) return resolver([]);
        requestAnimationFrame(mirar);
      };
      mirar();
    });
  };

  // En celulares no usamos el libro 3D, solo mostramos las tarjetas hacia abajo
  const [nodosMobil, setNodosMobil] = useState<string[]>([]);

  useEffect(() => {
    if (!esMobil) return;
    let cancelado = false;
    obtenerFuente().then((nodos) => {
      if (cancelado) return;
      setNodosMobil(nodos.map((n) => n.outerHTML));
      setCargando(false);
      setFuenteMontada(false);
    });
    return () => { cancelado = true; };
  }, [esMobil]);

  // Si estamos en computadora, preparamos las paginas para el libro 3D
  useEffect(() => {
    if (esMobil) return;
    let cancelado = false;

    /* Hay que esperar a que las tipografias esten listas: si se mide con la
       fuente de reserva, el texto crece al aplicarse la definitiva y algunas
       hojas terminan desbordadas. */
    const paginar = async () => {
      const nodos = await obtenerFuente();
      if (cancelado) return;
      const T0 = performance.now();

      if (nodos.length === 0) {
        setCargando(false);
        return;
      }

      /* Se pide ya, sin esperar: así el archivo viaja mientras se preparan el
         medidor y las tipografías, y no suma tiempo al final. */
      const promesaGuardada = cargarPaginacionGuardada(fuenteHtmlRef.current ?? '');

      /* Se mide contra el tamaño LÓGICO de la hoja, no contra el que se ve en
         pantalla: por eso el resultado ya no depende del viewport. */
      const { alto: ALTO_PAGINA, ancho: ANCHO_PAGINA } = HOJA;

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
        contain: layout style paint;
        --pf-escala: 1;
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

      /* Minimo que debe quedar libre debajo de un titulo para dejarlo al pie
         de la hoja: unas tres lineas de texto. Con menos, el titulo se ve
         colgado y se pasa entero a la hoja siguiente. */
      const MINIMO_TRAS_TITULO = 56;

      /** ¿Este HTML cabe entero en una hoja?
       *  Cada medida cuesta un reflujo completo del medidor, y el paginador
       *  repite muchisimas combinaciones (busquedas binarias, prefijos que
       *  vuelven a probarse, y la validacion final que remide hoja por hoja).
       *  Con la cache el numero de reflujos reales baja drasticamente. */
      const memoAlto = new Map<string, number>();
      /** Altura REAL que ocupa este HTML dentro de una hoja.
       *  No sirve scrollHeight: en un contenedor flex nunca devuelve menos que
       *  la altura de la caja, asi que siempre daba 'hoja llena' y no permitia
       *  saber cuanto quedaba libre. Hay que mirar donde acaba el ultimo hijo. */
      const alto = (html: string): number => {
        const guardado = memoAlto.get(html);
        if (guardado !== undefined) return guardado;
        medidor.innerHTML = html;
        const arriba = medidor.getBoundingClientRect().top;
        let usado = 0;
        for (const hijo of Array.from(medidor.children)) {
          usado = Math.max(usado, (hijo as HTMLElement).getBoundingClientRect().bottom - arriba);
        }
        memoAlto.set(html, usado);
        return usado;
      };
      const memoCabe = new Map<string, boolean>();
      const cabe = (html: string): boolean => {
        const guardado = memoCabe.get(html);
        if (guardado !== undefined) return guardado;
        medidor.innerHTML = html;
        const entra = medidor.scrollHeight <= ALTO_UTIL;
        memoCabe.set(html, entra);
        return entra;
      };

      /* ── Atajo: paginación ya calculada ──────────────────────────────────
         `npm run paginar` deja el reparto de hojas hecho en public/paginacion/.
         Si el archivo existe para este contenido y todas sus hojas siguen
         cabiendo aquí, nos ahorramos las ~2000 medidas.
         Se vuelve a comprobar hoja por hoja a propósito: el archivo se generó
         en otro equipo y, si las tipografías rasterizan distinto, alguna hoja
         podría desbordarse. Ante la duda, se pagina como siempre. */
      const guardada = await promesaGuardada;
      if (cancelado) {
        medidorHoja.remove();
        return;
      }
      if (guardada && guardada.bloques.every((b) => cabe(b))) {
        medidorHoja.remove();
        if (import.meta.env.DEV) {
          console.log(`[PageFlip] ${guardada.bloques.length} páginas desde paginación guardada`);
        }
        setAjustadas(guardada.ajustadas);
        setPaginas(guardada.bloques);
        setTotalPaginas(guardada.bloques.length);
        setCargando(false);
        setFuenteMontada(false);
        return;
      }
      if (guardada && import.meta.env.DEV) {
        console.warn('[PageFlip] la paginación guardada no encaja aquí; se recalcula');
      }


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
      const partirPorTexto = (el: HTMLElement, prefijo = ''): string[] => {
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
        if (piezas.length < 2) {
          return prefijo !== '' && !cabe(prefijo + el.outerHTML)
            ? ['', el.outerHTML]
            : [el.outerHTML];
        }

        /* `continuacion` marca los pedazos que no empiezan parrafo: llevan
           clase pf-continua para que el CSS les quite la sangria de primera
           linea (vienen partidos de la hoja anterior). */
        const armar = (desde: number, hasta: number, continuacion = false) => {
          const clon = el.cloneNode(false) as HTMLElement;
          if (continuacion) clon.classList.add('pf-continua');
          clon.innerHTML = piezas.slice(desde, hasta).join('');
          return clon.outerHTML;
        };

        const trozos: string[] = [];
        let desde = 0;
        let primero = true;
        while (desde < piezas.length) {
          const delante = primero ? prefijo : '';
          const esContinuacion = desde > 0;
          /* Busqueda binaria del mayor corte que todavia cabe: evita medir
             palabra por palabra, que seria lentisimo. */
          let bajo = desde + 1;
          let alto = piezas.length;
          let mejor = 0;
          while (bajo <= alto) {
            const medio = Math.floor((bajo + alto) / 2);
            if (cabe(delante + armar(desde, medio, esContinuacion))) {
              mejor = medio;
              bajo = medio + 1;
            } else {
              alto = medio - 1;
            }
          }
          if (mejor === 0) {
            /* Ni una palabra entra junto a lo que ya hay: hoja nueva. */
            if (primero && prefijo !== '') {
              trozos.push('');
              primero = false;
              continue;
            }
            mejor = desde + 1; // hoja vacia y aun asi no cabe: forzamos avance
          }
          trozos.push(armar(desde, mejor, esContinuacion));
          desde = mejor;
          primero = false;
        }
        return trozos.length ? trozos : [el.outerHTML];
      };

      /**
       * Parte un elemento que por sí solo no cabe en una hoja.
       * Tablas -> por filas (repitiendo encabezado y titulo); listas -> por ítems;
       * contenedores -> por sus hijos (recursivo); y como último recurso,
       * el propio texto se reparte por palabras.
       */
      const dividirNodo = (el: HTMLElement, profundidad = 0, prefijo = ''): string[] => {
        /* Cuando no hay forma de partir el elemento: si no cabe junto a lo que
           ya ocupa la hoja, se avisa con un trozo vacio para que empiece en la
           siguiente. */
        const entero = (): string[] =>
          prefijo !== '' && !cabe(prefijo + el.outerHTML) ? ['', el.outerHTML] : [el.outerHTML];

        /* Bloques que no tiene sentido cortar por la mitad (una firma, un pie
           de tabla…). Si no caben en lo que queda de hoja, pasan enteros a la
           siguiente en vez de repartirse. */
        if (el.classList.contains('pf-no-partir')) return entero();

        const tabla = el.matches('figure.tabla-academica')
          ? el.querySelector('table')
          : el.tagName.toLowerCase() === 'table'
            ? (el as HTMLTableElement)
            : null;

        if (tabla) {
          const filas = Array.from(tabla.querySelectorAll('tbody > tr'));
          if (filas.length < 2) return entero();

          const nuevoMolde = (continuacion: boolean) => {
            const m = el.cloneNode(true) as HTMLElement;
            if (continuacion) m.classList.add('tabla-academica--cont');
            m.querySelector('tbody')!.innerHTML = '';
            /* La nota al pie solo va en el ultimo trozo */
            if (continuacion) m.querySelector('.tabla-academica__nota')?.remove();
            return m;
          };

          const trozos: string[] = [];
          let molde = nuevoMolde(false);
          let cuerpo = molde.querySelector('tbody')!;
          let puestas = 0;
          let primero = true;

          for (const fila of filas) {
            cuerpo.appendChild(fila.cloneNode(true));
            puestas++;
            const delante = primero ? prefijo : '';
            if (cabe(delante + molde.outerHTML)) continue;

            if (puestas > 1) {
              cuerpo.removeChild(cuerpo.lastChild!);
              trozos.push(molde.outerHTML);
              primero = false;
              molde = nuevoMolde(true);
              cuerpo = molde.querySelector('tbody')!;
              cuerpo.appendChild(fila.cloneNode(true));
              puestas = 1;
            } else if (primero && prefijo !== '') {
              /* Ni la primera fila entra junto a lo que ya hay: hoja nueva. */
              trozos.push('');
              primero = false;
            }
          }
          if (puestas > 0) trozos.push(molde.outerHTML);
          return trozos.length ? trozos : entero();
        }

        const tag = el.tagName.toLowerCase();
        if (tag === 'ul' || tag === 'ol') {
          const items = Array.from(el.children) as HTMLElement[];
          if (items.length === 0) return partirPorTexto(el, prefijo);

          const trozos: string[] = [];
          let molde = el.cloneNode(false) as HTMLElement;
          let puestos = 0;
          let primero = true;
          const cerrar = () => {
            if (puestos > 0) {
              trozos.push(molde.outerHTML);
              primero = false;
            }
            molde = el.cloneNode(false) as HTMLElement;
            puestos = 0;
          };

          for (const item of items) {
            const delante = () => (primero ? prefijo : '');

            /* Un item que ni siquiera cabe solo en una hoja: se reparte su
               texto y cada pedazo viaja dentro de su propia copia de la lista. */
            const soloItem = el.cloneNode(false) as HTMLElement;
            soloItem.appendChild(item.cloneNode(true));
            if (!cabe(soloItem.outerHTML)) {
              cerrar();
              for (const pedazo of partirPorTexto(item, delante())) {
                if (pedazo === '') {
                  trozos.push('');
                  primero = false;
                  continue;
                }
                const envoltorio = el.cloneNode(false) as HTMLElement;
                envoltorio.innerHTML = pedazo;
                trozos.push(envoltorio.outerHTML);
                primero = false;
              }
              continue;
            }

            molde.appendChild(item.cloneNode(true));
            puestos++;
            if (cabe(delante() + molde.outerHTML)) continue;

            if (puestos > 1) {
              molde.removeChild(molde.lastChild!);
              trozos.push(molde.outerHTML);
              primero = false;
              molde = el.cloneNode(false) as HTMLElement;
              molde.appendChild(item.cloneNode(true));
              puestos = 1;
            } else if (primero && prefijo !== '') {
              trozos.push('');
              primero = false;
            }
          }
          cerrar();
          return trozos.length ? trozos : entero();
        }

        /* ¿Es un elemento con texto propio (un párrafo con negritas dentro) o
           un simple contenedor? En el primer caso NO se puede repartir por
           hijos: se perderían los nodos de texto sueltos. */
        const tieneTextoPropio = Array.from(el.childNodes).some(
          (n) => n.nodeType === 3 && (n.textContent || '').trim() !== '',
        );
        if (tieneTextoPropio) return partirPorTexto(el, prefijo);

        /* Contenedor genérico (el <article> de la ruta de artículo, la hoja de
           índice…): lo repartimos por sus hijos en vez de dejar que se corte. */
        const hijos = Array.from(el.children) as HTMLElement[];
        if (profundidad < 6 && hijos.length >= 1) {
          const trozos: string[] = [];
          let buffer = '';
          let primero = true;
          const delante = () => (primero ? prefijo : '');
          const cerrar = () => {
            trozos.push(buffer);
            buffer = '';
            primero = false;
          };

          for (const hijo of hijos) {
            const hijoHtml = hijo.outerHTML;

            /* ¿Entra tal cual en lo que queda de hoja? */
            if (cabe(delante() + buffer + hijoHtml)) {
              buffer += hijoHtml;
              continue;
            }

            /* No entra entero: en vez de cerrar la hoja y dejarla a medias,
               se parte el hijo para que su primer pedazo termine de llenarla. */
            const sub = dividirNodo(hijo, profundidad + 1, delante() + buffer);
            for (let si = 0; si < sub.length; si++) {
              const pedazo = sub[si];
              if (si === 0) {
                if (pedazo === '') {
                  /* Nada de este hijo cabe aqui: se cierra la hoja actual. Si
                     no habia nada acumulado, la hoja del prefijo la cierra
                     quien nos llamo; en ambos casos el prefijo ya no cuenta
                     para las siguientes medidas. */
                  if (buffer !== '') cerrar();
                  else primero = false;
                  continue;
                }
                buffer += pedazo;
                if (sub.length > 1) cerrar();
                continue;
              }
              if (si === sub.length - 1) buffer = pedazo;
              else trozos.push(pedazo);
            }
          }
          if (buffer !== '') trozos.push(buffer);
          if (trozos.length > 1) return trozos;
          /* Aunque quede un solo trozo, quitar el envoltorio puede haber
             bastado para que quepa: hay que quedarse con el, no con el
             elemento original que sabemos que desborda. */
          if (trozos.length === 1 && cabe(delante() + trozos[0])) return trozos;
        }

        /* Ya no hay estructura que partir: repartimos el texto por palabras. */
        return partirPorTexto(el, prefijo);
      };

      /**
       * Coloca los trozos devueltos por dividirNodo: el primero completa la
       * hoja en curso (salvo que venga vacio, que significa "aqui ya no cabe
       * nada"), los intermedios son hojas enteras y el ultimo queda abierto.
       * Devuelve el nuevo contenido pendiente de la hoja en curso.
       */
      const colocarTrozos = (
        sub: string[],
        buffer: string,
        emitir: (hoja: string) => void,
      ): string => {
        for (let i = 0; i < sub.length; i++) {
          const pedazo = sub[i];
          if (i === 0) {
            if (pedazo === '') {
              if (buffer !== '') {
                emitir(buffer);
                buffer = '';
              }
              continue;
            }
            buffer += pedazo;
            if (sub.length > 1) {
              emitir(buffer);
              buffer = '';
            }
            continue;
          }
          if (i === sub.length - 1) buffer = pedazo;
          else emitir(pedazo);
        }
        return buffer;
      };

      const bloques: string[] = [];
      let actual = '';
      const articuloPageMap: Record<string, number> = {};

      for (const nodo of nodos) {
        const html = nodo.outerHTML;
        
        const esEspecial = nodo.classList.contains('hoja-portada') ||
                           nodo.classList.contains('hoja-contraportada') ||
                           nodo.classList.contains('hoja-creditos') ||
                           nodo.classList.contains('hoja-editorial') ||
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
            /* El folio impreso de una hoja es su indice dentro de `paginas`
               (la portada es el 0), asi que el numero es bloques.length, no +1. */
            articuloPageMap[articuloIdx] = bloques.length;
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

            /* Si no entra en lo que queda de hoja, se parte para que su primer
               pedazo termine de llenarla, en vez de cerrar la hoja a medias. */
            if (!cabe(subActual + innerHtml)) {
              subActual = colocarTrozos(
                dividirNodo(inner, 0, subActual),
                subActual,
                (hoja) => bloques.push(hoja),
              );
              continue;
            }

            /* Un titulo no debe quedar solo al pie de una hoja. Pero si debajo
               todavia caben unas cuantas lineas, se deja aqui y el parrafo se
               parte: antes se llevaba titulo y parrafo enteros a la hoja
               siguiente y quedaba medio folio en blanco. */
            if (esHeading && fi + 1 < flatNodos.length && subActual !== '') {
              const nextHtml = flatNodos[fi + 1].outerHTML;
              const sitioDebajo = ALTO_UTIL - alto(subActual + innerHtml);
              if (
                sitioDebajo < MINIMO_TRAS_TITULO &&
                !cabe(subActual + innerHtml + nextHtml) &&
                cabe(innerHtml + nextHtml)
              ) {
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

        if (!cabe(actual + html)) {
          actual = colocarTrozos(
            dividirNodo(nodo, 0, actual),
            actual,
            (hoja) => bloques.push(hoja),
          );
          continue;
        }

        actual += html;
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
          if (!cabe(buffer + piezaHtml)) {
            buffer = colocarTrozos(
              dividirNodo(pieza, 0, buffer),
              buffer,
              (hoja) => validados.push(hoja),
            );
            continue;
          }
          buffer += piezaHtml;
        }
        if (buffer !== '') validados.push(buffer);
      }
      bloques.length = 0;
      bloques.push(...validados);

      /* Que hojas se justifican verticalmente (el texto termina abajo del
         todo). Solo las que ya estan bastante llenas y tienen varios bloques:
         repartir un hueco grande entre dos parrafos quedaria peor que dejarlo
         al final. Se calcula con el medidor todavia montado. */
      const marcas = bloques.map((b) => {
        medidor.innerHTML = b;
        const hijos = Array.from(medidor.children);
        if (hijos.length < 3) return false;
        const arriba = medidor.getBoundingClientRect().top;
        let abajo = arriba;
        for (const hijo of hijos) {
          abajo = Math.max(abajo, hijo.getBoundingClientRect().bottom);
        }
        const usado = abajo - arriba;
        return usado >= ALTO_UTIL * 0.7 && usado <= ALTO_UTIL;
      });

      document.body.removeChild(medidorHoja);

      const tempDiv = document.createElement('div');
      bloques.forEach((bloque, pageIdx) => {
        tempDiv.innerHTML = bloque;
        const artEl = tempDiv.querySelector('.hoja-articulo[data-articulo-idx]');
        if (artEl) {
          const idx = artEl.getAttribute('data-articulo-idx')!;
          if (!(idx in articuloPageMap)) {
            articuloPageMap[idx] = pageIdx;
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

      if (import.meta.env.DEV) {
        console.log(
          `[PageFlip] ${bloques.length} páginas · ${memoCabe.size} medidas reales · ` +
            `${Math.round(performance.now() - T0)} ms`,
          articuloPageMap,
        );
      }
      /* Salida para el script que precalcula la paginación (scripts/paginar.mjs).
         En producción no se ejecuta: el flag lo inyecta solo ese script. */
      if ((window as any).__PF_VOLCAR__) {
        (window as any).__PF_RESULTADO__ = {
          huella: huella(`${fuenteHtmlRef.current ?? ''}||${firmaEstilos()}`),
          hoja: HOJA,
          bloques,
          ajustadas: marcas,
        };
      }

      setAjustadas(marcas);
      setPaginas(bloques);
      setTotalPaginas(bloques.length);
      setCargando(false);
      /* Ya tenemos el HTML guardado: el slot original puede irse del DOM. */
      setFuenteMontada(false);
    };

    paginar();

    return () => {
      cancelado = true;
    };
    /* Ojo: ya NO depende de claveTamano. Antes cada redimensionado disparaba
       una repaginación completa (~3 s); ahora la hoja mide siempre lo mismo y
       basta con repintar el libro a otra escala. */
  }, [esMobil]);

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
        /* page-flip trabaja en píxeles reales: no se le puede aplicar un
           transform al libro porque su detección del ratón (getMousePos) resta
           el rect sin dividir por la escala y el arrastre quedaría descuadrado.
           Por eso la escala se aplica dentro de cada hoja, no aquí. */
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
        /* Al rehacer el libro tras un redimensionado, se vuelve a la hoja que
           estaba leyendo, no a la portada. */
        startPage: paginaActualRef.current,
        startZIndex: 0,
        swipeDistance: 30,
        clickEventForward: true,
      });

      pf.loadFromHTML(libroRef.current.querySelectorAll('.pf-hoja'));
      pf.on('flip', (e: any) => {
        paginaActualRef.current = e.data as number;
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
  }, [paginas, claveTamano]);

  const anterior = () => instanciaRef.current?.flipPrev?.();
  const siguiente = () => instanciaRef.current?.flipNext?.();

  /* Salto directo: se escribe el numero de pagina en el indicador y Enter
     lleva alli. No toca la revista: solo usa la API de page-flip. */
  const [salto, setSalto] = useState('');
  const irAPagina = () => {
    const n = parseInt(salto, 10);
    if (!Number.isFinite(n)) return;
    const destino = Math.min(totalPaginas, Math.max(1, n)) - 1;
    const pf = instanciaRef.current;
    try {
      pf?.flip?.(destino);
    } catch {
      pf?.turnToPage?.(destino);
    }
    setSalto('');
  };

  /* Que hojas son solo imagen (van a sangre). Se resolvia dentro del map de
     render, lo que reparseaba el HTML de TODAS las paginas en cada render
     (y hay uno por cada pase de hoja). Ahora se calcula una sola vez. */
  const posters = useMemo(() => {
    if (typeof document === 'undefined') return [] as string[];
    const temp = document.createElement('div');
    return paginas.map((html, i) => {
      if (i === 0 || i === paginas.length - 1) return '';
      temp.innerHTML = html;
      const texto = (temp.textContent || '').trim();
      const imgs = temp.querySelectorAll('img');
      if (texto.length === 0 && imgs.length === 1) {
        return imgs[0].src || imgs[0].getAttribute('src') || '';
      }
      return '';
    });
  }, [paginas]);

  // Vista para telefonos: tarjetas hacia abajo
  if (esMobil) {
    return (
      <div className="pf-contenedor pf-contenedor--mobil">
        {/* Usamos esto para leer el texto en el fondo sin que se vea */}
        {fuenteMontada && (
          <div ref={fuenteRef} className="pf-fuente" aria-hidden="true">
            {children}
          </div>
        )}

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
      {fuenteMontada && (
        <div ref={fuenteRef} className="pf-fuente" aria-hidden="true">
          {children}
        </div>
      )}

      {cargando && (
        <div className="pf-cargando" role="status">
          <span className="pf-spinner" aria-hidden="true" />
          <span>Preparando la revista…</span>
        </div>
      )}

      {/* La clave fuerza a React a rehacer las hojas tras un redimensionado:
          page-flip envuelve los nodos al montarse, asi que necesita DOM limpio
          para reconstruirse. Ojo: esto NO vuelve a paginar. */}
      <div
        ref={libroRef}
        key={claveTamano}
        className="pf-libro"
        aria-label="Revista con páginas"
        style={{ ['--pf-escala' as string]: String(escala) } as React.CSSProperties}
      >
        {paginas.map((html, i) => {
          const isCover = i === 0 || i === paginas.length - 1;
          const posterSrc = posters[i] || '';
          const esPoster = posterSrc !== '';

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
                    className={`pf-hoja__contenido${ajustadas[i] ? ' pf-hoja__contenido--ajustada' : ''}`}
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
          <form
            className="pf-salto"
            onSubmit={(e) => {
              e.preventDefault();
              irAPagina();
            }}
          >
            <input
              type="number"
              min={1}
              max={totalPaginas}
              inputMode="numeric"
              className="pf-salto__input"
              value={salto}
              onChange={(e) => setSalto(e.target.value)}
              placeholder={String(paginaActual + 1)}
              aria-label={`Ir a la página (1 a ${totalPaginas})`}
              title="Escribe una página y presiona Enter"
            />
            <span className="pf-salto__total">/ {totalPaginas}</span>
          </form>
          <button type="button" onClick={siguiente} aria-label="Página siguiente" className="pf-nav">
            Siguiente ›
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Huella del contenido. Sirve para saber si una paginación guardada sigue
 * correspondiendo al texto actual: si alguien edita un artículo y no vuelve a
 * generarla, la huella deja de cuadrar y se pagina en el navegador como
 * siempre. Nunca se queda una revista mal cortada por un JSON viejo.
 * FNV-1a en dos mitades para que 8 caracteres no den colisiones tontas.
 */
/**
 * Los nombres de los archivos CSS que genera Astro llevan un hash de su
 * contenido, así que sirven de firma de los estilos. Entran en la huella
 * porque la paginación depende tanto del texto como de la tipografía: si solo
 * se mirara el HTML, un cambio de interlineado reutilizaría un reparto viejo.
 */
const firmaEstilos = (): string =>
  Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((l) => l.getAttribute('href') || '')
    .sort()
    .join('|');

const huella = (s: string): string => {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b + c, 0x85ebca6b) ^ (b >>> 13);
  }
  return ((a >>> 0).toString(16) + (b >>> 0).toString(16)).padStart(16, '0');
};

/* ── Geometría de la hoja ─────────────────────────────────────────────────
   La hoja tiene un tamaño LÓGICO fijo: el texto siempre se maqueta contra
   estas medidas, pase lo que pase con la ventana. Eso hace que la paginación
   sea siempre la misma (misma revista en todos los equipos) y, sobre todo,
   que redimensionar ya no obligue a volver a paginar: solo cambia la escala
   con la que se pinta.
   Encoger la hoja equivale a agrandar la letra: como luego se escala para
   llenar el mismo hueco, todo (texto, imágenes y márgenes) se ve un 10% mayor
   sin tocar ni una sola de las ~35 reglas de tipografía. A cambio entra algo
   menos de texto por hoja.
   Proporción de tamaño carta: 8.5/11. Si cambias esto, ajusta también
   .pf-hoja__inner en revista.css y vuelve a ejecutar `npm run paginar`. */
const HOJA = { ancho: 587, alto: 760 };

/** Cuánto hay que encoger (o estirar) la hoja para que quepa en la ventana. */
const calcularEscala = () => {
  if (typeof window === 'undefined') return 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  // En pantallas anchas se ven 2 páginas a la vez; en estrechas, 1
  const hojasALaVez = w < 900 ? 1 : 2;
  const dispAlto = h - 120;
  const dispAncho = w < 900 ? w - 40 : w - 160;

  const escala = Math.min(dispAlto / HOJA.alto, dispAncho / (HOJA.ancho * hojasALaVez));
  /* El texto es vectorial y no se pixela al ampliarlo, así que el techo solo
     está para que la hoja no crezca sin sentido en monitores enormes. */
  return Math.max(0.45, Math.min(escala, 1.35));
};

/**
 * Busca la paginación precalculada que corresponde a este contenido.
 * Devuelve null ante cualquier duda (no existe, no cuadra la huella, se generó
 * con otra medida de hoja, tarda demasiado…) y entonces se pagina al vuelo.
 */
const cargarPaginacionGuardada = async (
  fuenteHtml: string,
): Promise<{ bloques: string[]; ajustadas: boolean[] } | null> => {
  if (!fuenteHtml) return null;
  /* El script que genera estos archivos necesita que se pagine de verdad; si
     no, leería su propia salida anterior y nunca se actualizaría. */
  if ((window as any).__PF_VOLCAR__) return null;
  try {
    const base = import.meta.env.BASE_URL || '/';
    const url = `${base}${base.endsWith('/') ? '' : '/'}paginacion/${huella(`${fuenteHtml}||${firmaEstilos()}`)}.json`;
    /* Si tarda más de esto, sale más a cuenta paginar aquí mismo. */
    const corte = new AbortController();
    const reloj = setTimeout(() => corte.abort(), 2500);
    const res = await fetch(url, { signal: corte.signal });
    clearTimeout(reloj);
    if (!res.ok) return null;

    const datos = await res.json();
    if (datos?.hoja?.ancho !== HOJA.ancho || datos?.hoja?.alto !== HOJA.alto) return null;
    if (!Array.isArray(datos.bloques) || datos.bloques.length === 0) return null;

    return {
      bloques: datos.bloques as string[],
      ajustadas: Array.isArray(datos.ajustadas) ? (datos.ajustadas as boolean[]) : [],
    };
  } catch {
    return null;
  }
};

/** Medidas en píxeles reales con las que se pinta cada hoja. */
const obtenerDimensionesCarta = () => {
  const escala = calcularEscala();
  return { ancho: HOJA.ancho * escala, alto: HOJA.alto * escala, escala };
};
