# Guía de Reemplazo de Contenido

Esta guía explica, paso a paso, dónde y cómo modificar **textos, imágenes, autores, colores y tipografías** de la revista. Está escrita para personas con conocimientos básicos de edición de texto — no es necesario saber programar.

## Índice rápido

1. [Filosofía: dónde vive cada cosa](#1-filosofía-dónde-vive-cada-cosa)
2. [Cambiar textos de un artículo existente](#2-cambiar-textos-de-un-artículo-existente)
3. [Cambiar imágenes](#3-cambiar-imágenes)
4. [Agregar un nuevo artículo](#4-agregar-un-nuevo-artículo)
5. [Agregar/editar autores](#5-agregareditar-autores)
6. [Cambiar la portada de la edición](#6-cambiar-la-portada-de-la-edición)
7. [Cambiar el Mensaje del Decano / Editorial / Créditos](#7-cambiar-el-mensaje-del-decano--editorial--créditos)
8. [Cambiar colores institucionales](#8-cambiar-colores-institucionales)
9. [Cambiar tipografías](#9-cambiar-tipografías)
10. [Generar una nueva edición (2027, 2028…)](#10-generar-una-nueva-edición-2027-2028)
11. [Tabla de placeholders disponibles](#11-tabla-de-placeholders-disponibles)
12. [Errores comunes](#12-errores-comunes)

---

## 1. Filosofía: dónde vive cada cosa

| Si quieres cambiar… | Edita en… |
|---|---|
| Texto de un artículo | `src/content/articulos/[archivo].mdx` |
| Imagen de un artículo | `src/assets/articulos/` + ref en el `.mdx` |
| Datos de un autor | `src/content/autores/[archivo].json` |
| Foto de un autor | `src/assets/autores/` + ref en el `.json` |
| Mensaje del Decano | `src/content/institucional/decano.md` |
| Editorial | `src/content/institucional/editorial.md` |
| Datos de la edición (título, fecha, equipo) | `src/content/ediciones/2026-1.json` |
| Colores institucionales | `src/styles/tokens.css` |
| Tipografías | `src/styles/tipografia.css` + `public/fonts/` |
| Logos universidad/facultad | `src/assets/portadas/` + ref en `2026-1.json` |
| Datos de contacto/redes del pie | `src/components/layout/Footer.astro` |

**Regla de oro:** si lo que quieres cambiar es **texto**, está en `src/content/`. Si es **estilo/diseño**, está en `src/styles/` o `src/components/`.

---

## 2. Cambiar textos de un artículo existente

Cada artículo es un archivo `.mdx` en `src/content/articulos/`. Tiene dos partes:

```mdx
---
plantilla: A                  ← qué plantilla usar (A, B, C, D)
seccion: investigacion        ← editorial | investigacion | entrevista | noticia | proyecto | evento | galeria | reconocimiento
edicion: "2026-1"
orden: 1                      ← orden en el índice
titulo: "[TITULO_ARTICULO_1]" ← REEMPLAZAR
subtitulo: "..."              ← REEMPLAZAR (opcional)
resumen: "..."                ← REEMPLAZAR (aparece en el grid de portada)
autores:
  - autor-uno                 ← debe coincidir con el nombre del archivo en /autores/
etiquetas: [investigacion]
fechaPublicacion: 2026-06-01
tiempoLectura: 8              ← minutos estimados
destacado: true               ← aparece como artículo grande en portada
---

[Texto del artículo aquí, en formato Markdown]
```

### Sintaxis Markdown más común

```markdown
## Título de sección             ← H2 (sección)
### Subtítulo                   ← H3

Texto en **negrita** y *itálica* y [enlaces](https://example.com).

- Lista con viñetas
- Otro elemento

1. Lista numerada
2. Otro elemento
```

### Componentes especiales (MDX)

Puedes incrustar componentes ricos dentro del texto:

```mdx
<Cita autor="Albert Einstein" variante="destacada">
  La imaginación es más importante que el conocimiento.
</Cita>

<Figura
  alt="Descripción accesible"
  pie="Fig 1. Descripción visible bajo la imagen"
  etiquetaPlaceholder="MI_FIGURA"
  ancho="amplio"
/>

<Tabla
  numero="Tabla 1"
  titulo="Resultados del estudio"
  columnas={[
    { clave: "var", etiqueta: "Variable" },
    { clave: "n", etiqueta: "n", alinear: "centro" }
  ]}
  filas={[
    { var: "Grupo A", n: 50 },
    { var: "Grupo B", n: 30 }
  ]}
/>

<Galeria
  columnas={3}
  items={[
    { alt: "Foto 1", pie: "Descripción 1" },
    { alt: "Foto 2", pie: "Descripción 2" }
  ]}
/>
```

---

## 3. Cambiar imágenes

### Opción A — Imagen de un artículo

1. Copia tu imagen a `src/assets/articulos/` (formatos: `.jpg`, `.png`, `.webp`, `.avif`).
2. En el `.mdx`, agrega al frontmatter:
   ```mdx
   imagenPrincipal: ../../assets/articulos/mi-imagen.jpg
   pieImagenPrincipal: "Pie de imagen visible"
   ```
3. Para imágenes dentro del cuerpo del artículo:
   ```mdx
   import miImagen from '../../assets/articulos/figura-1.jpg';

   <Figura src={miImagen} alt="..." pie="Fig 1. ..." />
   ```

Astro optimizará la imagen automáticamente (genera AVIF, WebP, varios tamaños).

### Opción B — Imagen de un autor

1. Copia a `src/assets/autores/mi-autor.jpg`.
2. En `src/content/autores/[autor].json`:
   ```json
   { "foto": "../../assets/autores/mi-autor.jpg" }
   ```

### Opción C — Placeholders mientras no hay imagen

Si una imagen no existe aún, el sistema muestra automáticamente un **placeholder visual** con la etiqueta indicada — no rompe nada, sólo deja claro qué falta.

---

## 4. Agregar un nuevo artículo

1. **Crea el archivo:** `src/content/articulos/NN-mi-articulo.mdx` (NN = orden, ej. `05-mi-articulo.mdx`).
2. **Copia el frontmatter** de otro artículo del mismo tipo de plantilla y ajústalo.
3. **Escribe el contenido en Markdown** (o MDX si necesitas componentes).
4. **Listo.** El artículo aparece automáticamente en el índice y en `/articulo/NN-mi-articulo`.

### Elegir plantilla

| Plantilla | Cuándo usar |
|---|---|
| **A — Estándar** | Artículos de lectura larga, una columna, drop cap. Default. |
| **B — Dos columnas** | Reportajes con citas pull, imágenes que rompen el grid. Estilo revista. |
| **C — Reportaje** | Entrevistas, galerías destacadas. Hero a página completa + texto lateral. |
| **D — Académica** | Papers con DOI, palabras clave, tablas, secciones numeradas, referencias APA. |

---

## 5. Agregar/editar autores

Cada autor es un JSON en `src/content/autores/`:

```json
{
  "nombre": "María Pérez",
  "cargo": "Profesora Asociada",
  "afiliacion": "Departamento de Ingeniería Civil",
  "bio": "Doctora en Estructuras por la Universidad XYZ...",
  "foto": "../../assets/autores/maria-perez.jpg",
  "email": "maria@universidad.edu",
  "orcid": "0000-0001-2345-6789",
  "redes": {
    "linkedin": "https://linkedin.com/in/maria",
    "web": "https://web.de/maria"
  }
}
```

**Nombre del archivo = referencia del autor.** Si el archivo se llama `maria-perez.json`, en los artículos usas `autores: [maria-perez]`.

---

## 6. Cambiar la portada de la edición

Edita `src/content/ediciones/2026-1.json`:

```json
{
  "numero": "2026-1",
  "titulo": "Innovación y Sostenibilidad",
  "subtitulo": "Reflexiones desde la ingeniería contemporánea",
  "fechaPublicacion": "2026-06-01",
  "tema": "Sostenibilidad",
  "activa": true,                            ← debe estar en true
  "portada": "../../assets/portadas/cover-2026-1.jpg",
  "logoUniversidad": "../../assets/portadas/logo-univ.png",
  "logoFacultad": "../../assets/portadas/logo-fac.png",
  "consejoEditorial": [
    { "nombre": "Dr. Juan García", "cargo": "Director Editorial" }
  ],
  "colofon": "Esta edición fue compuesta en..."
}
```

---

## 7. Cambiar el Mensaje del Decano / Editorial / Créditos

| Sección | Archivo |
|---|---|
| Mensaje del Decano | `src/content/institucional/decano.md` |
| Editorial | `src/content/institucional/editorial.md` |
| Créditos institucionales | `src/content/ediciones/2026-1.json` → `consejoEditorial` |

Cada `.md` tiene el mismo formato: frontmatter (datos del autor) + cuerpo en Markdown.

---

## 8. Cambiar colores institucionales

Edita **un solo archivo:** `src/styles/tokens.css`. Las variables relevantes:

```css
--color-azul-oxford:        #002147;  ← color principal institucional
--color-azul-oxford-claro:  #1a3a66;
--color-azul-oxford-oscuro: #00152e;
--color-dorado:             #C5A059;  ← color de acento
--color-dorado-claro:       #E6C680;
--color-dorado-oscuro:      #8e7239;
--color-papel:              #FDFCF7;  ← fondo (modo claro)
--color-tinta:              #1A1A1A;  ← texto principal
```

El cambio se propaga **automáticamente** a toda la revista.

Para modo oscuro, edita el bloque `[data-tema='oscuro']` del mismo archivo.

---

## 9. Cambiar tipografías

### Opción A — Usar otras fuentes auto-hospedadas

1. Descarga los archivos `.woff2` y colócalos en `public/fonts/`.
2. Edita `src/styles/tipografia.css`, sección `@font-face`, y apunta a los nuevos archivos.
3. En `src/styles/tokens.css`, cambia las variables:
   ```css
   --font-serif:  'Mi Serif', Georgia, serif;
   --font-sans:   'Mi Sans', system-ui, sans-serif;
   ```

### Opción B — Usar Google Fonts (no recomendado, pero posible)

En `BaseLayout.astro` agrega antes del `</head>`:

```html
<link href="https://fonts.googleapis.com/css2?family=Lora&family=Inter&display=swap" rel="stylesheet">
```

Y actualiza `--font-serif`/`--font-sans` en `tokens.css`.

---

## 10. Generar una nueva edición (2027, 2028…)

```
ANTES                                    DESPUÉS
src/content/ediciones/2026-1.json        src/content/ediciones/2026-1.json   ("activa": false)
                                          src/content/ediciones/2027-1.json   ("activa": true)
src/content/articulos/01-...mdx          src/content/articulos/01-...mdx     (edicion: "2027-1")
                                         ...
```

**Pasos exactos:**

1. **Marca la edición vieja como inactiva.** En `src/content/ediciones/2026-1.json` cambia `"activa": true` → `false`.
2. **Crea la nueva edición.** Duplica el archivo a `2027-1.json`, cambia el contenido y deja `"activa": true`.
3. **Decide qué hacer con los artículos viejos:**
   - **Eliminarlos:** borra los `.mdx` (perderás el contenido en la web).
   - **Archivarlos:** déjalos pero cambia su `edicion:` a `"2026-1"` (no aparecerán en la portada de la 2027-1).
4. **Crea los artículos nuevos** con `edicion: "2027-1"`.
5. **Sube imágenes nuevas** a `src/assets/portadas/`, `src/assets/articulos/`, etc.
6. `npm run build`.
7. `git push` → Vercel despliega.

> **Importante:** sólo debe existir **una edición con `activa: true`** a la vez. Si hay varias, el sistema toma la primera por orden alfabético.

---

## 11. Tabla de placeholders disponibles

Por convención, todos los textos editables temporales están marcados con `[ETIQUETA_EN_MAYUSCULAS]`. Buscar y reemplazar `[` en tu editor te muestra todo lo pendiente.

| Placeholder | Dónde aparece |
|---|---|
| `[TITULO_EDICION]` | Portada principal |
| `[SUBTITULO_EDICION]` | Portada principal |
| `[TEMA_CENTRAL_EDICION]` | Portada principal |
| `[TITULO_ARTICULO_N]` | Frontmatter de artículos |
| `[SUBTITULO_ARTICULO_N]` | Frontmatter de artículos |
| `[RESUMEN_ARTICULO_N]` | Aparece en grid y al inicio del artículo (plantilla D) |
| `[NOMBRE_AUTOR_N]` | `src/content/autores/` |
| `[CARGO_AUTOR_N]` | `src/content/autores/` |
| `[BIO_AUTOR_N]` | `src/content/autores/` |
| `[NOMBRE_DECANO]` | Mensaje del Decano + sección Decano |
| `[NOMBRE_DIRECTOR]` `[NOMBRE_EDITOR]` etc. | Consejo editorial en `2026-1.json` |
| `[CORREO_REVISTA]` `[TELEFONO]` etc. | `Footer.astro` y `contraportada.astro` |
| `[ISSN_PLACEHOLDER]` | Pie de portada y créditos |
| `[IMAGEN_PORTADA_EDICION]` `[IMAGEN_PRINCIPAL]` etc. | Visibles como placeholders gráficos hasta que pongas la imagen |

---

## 12. Errores comunes

### El build falla con un error de schema

Significa que un dato obligatorio falta o tiene tipo incorrecto. El mensaje te indicará el archivo y campo. Ej:
```
articulos/05-mi-articulo.mdx: titulo is required
```
→ falta el campo `titulo:` en el frontmatter.

### Una imagen no aparece

- ¿La ruta en el `.mdx` es correcta? Astro espera rutas **relativas al archivo `.mdx`** (típicamente `../../assets/...`).
- ¿El archivo está dentro de `src/assets/`? Imágenes en `public/` no se optimizan ni se validan.

### Cambié un color y no se ve

- Reinicia el dev server (`Ctrl+C` y `npm run dev` de nuevo).
- En el navegador, fuerza un hard reload (`Ctrl+Shift+R`).

### El modo revista no se activa

- Por defecto se activa en pantallas ≤ 900px o cuando el usuario selecciona "Revista" en el header.
- Si el usuario tiene activado `prefers-reduced-motion`, el modo revista no se activa (es intencional, para accesibilidad).

### Quiero agregar un nuevo tipo de sección

Edita `src/content/config.ts`, en `articulos.schema`, agrega el valor al `z.enum([...])` de `seccion`. También agrégalo al diccionario `tituloSeccion()` en `src/lib/edicion.ts`.
