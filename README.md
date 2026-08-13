# Revista de Ingeniería 2026

Esqueleto editorial digital reutilizable por edición para la Facultad de Ingeniería. Construido con Astro 5, Tailwind v4, MDX y React.

## Filosofía del proyecto

**Diseño y contenido están separados.** Para publicar una nueva edición no es necesario tocar código de programación: basta con escribir o reemplazar los archivos de texto en `src/content/` y las fotos en `src/assets/`.

## Tecnologías Utilizadas

| Capa | Tecnología | Por qué se eligió |
|---|---|---|
| Estructura | **Astro 5** | Genera páginas web súper rápidas. |
| Estilos | **Tailwind v4** | Maneja todos los colores y diseños visuales. |
| Contenido | **MDX** | Permite escribir los artículos de forma sencilla. |
| Interactividad | **React** | Hace funcionar el libro 3D y el modo oscuro. |
| Animación de hojas | **StPageFlip** | Crea el efecto real de pasar la página con sombras. |
| Servidor | **Vercel** | Permite publicar la revista en internet gratis. |

## Comandos Principales

Para probar el proyecto en tu computadora:

```bash
npm install      # Instala las herramientas necesarias
npm run dev      # Enciende la revista en http://localhost:4321
npm run publicar # Prepara el proyecto final para subirlo a internet
```

### Importante al cambiar el contenido

Usa **`npm run publicar`** (no `npm run build`) cada vez que edites artículos.

Repartir el texto en hojas es un cálculo caro: si lo hiciera el navegador de
cada lector, la revista tardaría ~2 segundos en aparecer. Por eso `npm run
publicar` construye el sitio y además deja ese reparto ya resuelto en
`public/paginacion/`. **Esos archivos hay que subirlos al repositorio**, porque
Vercel no puede generarlos.

Si se te olvida regenerarlos no se rompe nada: la revista detecta que el
contenido cambió y vuelve a repartir las hojas en el navegador, como antes.
Solo se pierde la ganancia de velocidad.

### Si cambias la foto de la portada

La hoja tiene proporción de tamaño carta y la foto normalmente no, así que hay
un paso que la recompone para que llene la hoja sin dejar franjas:

```bash
npm run portada    # lee volumenII.jpeg y genera portada-volumenII.jpg
```

Solo hay que ejecutarlo cuando cambie la foto original. Si la foto nueva tiene
el texto en otro sitio, hay que ajustar las coordenadas anotadas en
`scripts/portada.mjs` (están medidas sobre la imagen actual).

## Cómo subir a Vercel (Publicar en internet)

1. Sube esta carpeta a un repositorio en **GitHub**.
2. Entra a **Vercel.com**, dale a *New Project* e importa el repositorio.
3. Vercel detectará que es un proyecto de Astro y lo publicará automáticamente.
4. En pocos minutos te dará un enlace web real (ejemplo: `tu-revista.vercel.app`).

## Estructura de Carpetas

```text
src/
├── content/        ← AQUÍ VA EL CONTENIDO: artículos, datos de autores y ediciones.
├── assets/         ← AQUÍ VAN LAS IMÁGENES: fotos y logos de los artículos.
├── components/     ← Piezas de diseño (botones, tarjetas, etc).
├── layouts/        ← Los "moldes" base de la revista.
├── pages/          ← Las páginas web (inicio, índice, portada).
├── styles/         ← Los estilos visuales y colores.
└── lib/            ← Archivos de funcionamiento interno.
public/
├── sonidos/        ← El sonido real de pasar la página.
scripts/            ← Herramientas automáticas internas.
docs/               ← Guía completa de reemplazo de contenido.
```

## Funcionalidades Incluidas

- ✅ **Portada institucional** con foto de fondo y logos.
- ✅ **Índice interactivo** que se arma automáticamente.
- ✅ **Modo Lectura Tradicional** (haciendo scroll hacia abajo).
- ✅ **Modo Revista 3D** (pasando las hojas con el ratón o el dedo).
- ✅ **Sonido realista** de hoja de papel al pasar la página.
- ✅ **Modo Oscuro / Claro** para lectura de noche.
- ✅ **Ajuste de tamaño de letra** a gusto del lector.
- ✅ **Optimización automática de imágenes** para que cargue rápido.
- ✅ **Adaptación a celulares y tablets** de forma automática.

## Para publicar una nueva edición (Ej: Año 2027)

Lee el manual detallado en **`docs/GUIA_REEMPLAZO_CONTENIDO.md`**. Resumen rápido:

1. Ve a `src/content/ediciones/` y crea el archivo `2027-1.json` con `"activa": true`.
2. Al archivo viejo (`2026-1.json`) cámbiale el estado a `"activa": false`.
3. Borra los artículos viejos, sube los nuevos en `src/content/articulos/` y asegúrate de que digan `edicion: "2027-1"`.
4. Sube las nuevas fotos a `src/assets/`.
5. Sube los cambios a GitHub.

**Cero cambios de código requeridos.**
