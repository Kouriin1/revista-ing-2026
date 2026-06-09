import { defineCollection, z, reference } from 'astro:content';
import { glob, file } from 'astro/loaders';

/* =========================================================================
   SCHEMAS DE CONTENIDO
   Toda la informacion editable de la revista pasa por estos schemas.
   Si un dato no cumple, el build FALLA antes de produccion.
   ========================================================================= */

const ediciones = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/ediciones' }),
  schema: ({ image }) =>
    z.object({
      numero: z.string(),                              // ej. "2026-1"
      titulo: z.string(),                              // titulo de portada de la edicion
      subtitulo: z.string().optional(),
      fechaPublicacion: z.coerce.date(),
      tema: z.string().optional(),                     // tema de la edicion
      portada: image().optional(),
      logoUniversidad: image().optional(),
      logoFacultad: image().optional(),
      activa: z.boolean().default(false),              // solo UNA edicion deberia ser activa
      consejoEditorial: z
        .array(
          z.object({
            nombre: z.string(),
            cargo: z.string(),
          }),
        )
        .default([]),
      colofon: z.string().optional(),
    }),
});

const autores = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/autores' }),
  schema: ({ image }) =>
    z.object({
      nombre: z.string(),
      cargo: z.string().optional(),
      bio: z.string().optional(),
      foto: image().optional(),
      email: z.string().email().optional(),
      orcid: z.string().optional(),
      afiliacion: z.string().optional(),
      redes: z
        .object({
          linkedin: z.string().url().optional(),
          twitter: z.string().url().optional(),
          web: z.string().url().optional(),
        })
        .optional(),
    }),
});

const articulos = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/articulos' }),
  schema: ({ image }) =>
    z.object({
      plantilla: z.enum(['A', 'B', 'C', 'D']).default('A'),
      seccion: z.enum([
        'editorial',
        'investigacion',
        'entrevista',
        'noticia',
        'proyecto',
        'evento',
        'galeria',
        'reconocimiento',
      ]),
      edicion: z.string().default('2026-1'),
      orden: z.number().int().nonnegative().default(0),
      titulo: z.string(),
      subtitulo: z.string().optional(),
      resumen: z.string().optional(),
      autores: z.array(reference('autores')).default([]),
      autoresInvitados: z.array(z.string()).default([]),  // autores sin ficha (string libre)
      imagenPrincipal: image().optional(),
      pieImagenPrincipal: z.string().optional(),
      etiquetas: z.array(z.string()).default([]),
      fechaPublicacion: z.coerce.date().optional(),
      tiempoLectura: z.number().int().positive().optional(), // minutos
      destacado: z.boolean().default(false),
      borrador: z.boolean().default(false),
      // Campos especificos plantilla D (academica)
      doi: z.string().optional(),
      palabrasClave: z.array(z.string()).default([]),
      referencias: z
        .array(
          z.object({
            cita: z.string(),
            url: z.string().url().optional(),
          }),
        )
        .default([]),
    }),
});

const institucional = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/institucional' }),
  schema: ({ image }) =>
    z.object({
      tipo: z.enum(['mensaje-decano', 'editorial', 'creditos', 'contraportada', 'mision', 'otro']),
      titulo: z.string(),
      autor: z.string().optional(),
      cargo: z.string().optional(),
      foto: image().optional(),
      orden: z.number().int().default(0),
    }),
});

export const collections = {
  ediciones,
  autores,
  articulos,
  institucional,
};
