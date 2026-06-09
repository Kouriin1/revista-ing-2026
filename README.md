# Revista de Ingeniería 2026

Esqueleto editorial digital reutilizable por edición para la Facultad de Ingeniería. Construido con Astro 5, Tailwind v4, MDX y React (sólo en islands interactivas).

## Filosofía del proyecto

**Diseño y contenido están separados.** Para publicar una nueva edición no es necesario tocar código: basta con escribir/reemplazar archivos en `src/content/` y `src/assets/`.

## Stack

| Capa | Tecnología | Por qué |
|---|---|---|
| Framework | **Astro 5** | HTML estático por defecto, máximo rendimiento. Islands para JS opcional. |
| Estilos | **Tailwind v4** + CSS custom | Tokens institucionales centralizados. |
| Contenido | **MDX + Content Collections** | Schemas validados con Zod. Si falta un dato, el build falla. |
| Interactividad | **React** (sólo islands) | Selectores de tema/fuente/modo, page-flip. |
| Estado global | **nanostores** | Preferencias persistidas en localStorage. |
| Page-flip | **StPageFlip** | Efecto hoja real con curvatura, sombras, gestos. |
| Hosting | **Vercel** (estático) | Sin adapter requerido. Auto-deploy desde git. |

## Comandos

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # genera ./dist
npm run preview  # sirve ./dist localmente
npm run check    # type-check de Astro y MDX
```

## Despliegue en Vercel

1. Sube el proyecto a un repositorio en GitHub/GitLab.
2. En Vercel: *New Project* → importa el repo.
3. Vercel detecta Astro automáticamente y usa `astro build` + `dist/` (configuración en `vercel.json`).
4. La primera build estará disponible en `<proyecto>.vercel.app`.

> **Sin adapter:** Como usamos `output: 'static'` (default), no se necesita `@astrojs/vercel`. Si en el futuro requiriéramos SSR, ISR o image optimization de Vercel, basta con instalar el adapter y cambiar `output: 'server'` en `astro.config.mjs`.

## Estructura

```
src/
├── content/        ← TODO el contenido editable (ver GUIA_REEMPLAZO_CONTENIDO.md)
├── assets/         ← Imágenes optimizadas automáticamente por Astro
├── components/
│   ├── layout/     ← Header, Footer, ReadingProgress
│   ├── plantillas/ ← Las 4 plantillas de artículo (A, B, C, D)
│   ├── ui/         ← Placeholder, Cita, Figura, Tabla, Galería, Referencias, CardArticulo
│   └── islands/    ← Selectores y PageFlip (solo aquí carga JS)
├── layouts/        ← BaseLayout, ArticuloLayout
├── pages/          ← Rutas
├── styles/         ← tokens, tipografía, temas, controles, revista
└── lib/            ← Helpers (store, audio, edicion)
public/
├── fonts/          ← Source Serif 4 + Inter (auto-hospedadas)
└── sonidos/        ← page-turn.mp3
```

## Funcionalidades incluidas

- ✅ Portada institucional con foto de fondo y datos de edición
- ✅ Índice navegable agrupado por sección
- ✅ Mensaje del Decano, Editorial, Contraportada
- ✅ 4 plantillas de artículo reutilizables (Estándar, Dos Columnas, Reportaje, Académica)
- ✅ Modo Revista (page-flip con sonido opcional) en móvil
- ✅ Modo Lectura (scroll tradicional) por defecto en desktop
- ✅ Modo claro / oscuro / auto
- ✅ Selector de tamaño de fuente (4 niveles)
- ✅ Sistema de placeholders `[ETIQUETA_EN_MAYUSCULAS]`
- ✅ Imágenes optimizadas (AVIF/WebP, srcset, lazy loading)
- ✅ View Transitions API para navegación fluida
- ✅ Accesibilidad: skip link, focus visible, ARIA, `prefers-reduced-motion`
- ✅ SEO: OG tags, descriptions, canonical
- ✅ Responsive: móvil, tablet, laptop, ultrawide

## Para publicar una nueva edición (2027, 2028…)

Lee **`GUIA_REEMPLAZO_CONTENIDO.md`**. Resumen rápido:

1. Crear `src/content/ediciones/2027-1.json` con `"activa": true`.
2. Marcar la edición anterior con `"activa": false`.
3. Mover/duplicar los `.mdx` de artículos cambiando `edicion: "2027-1"`.
4. Reemplazar imágenes en `src/assets/` y autores en `src/content/autores/`.
5. `npm run build` y push.

Cero cambios de código.
