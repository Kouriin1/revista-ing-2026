import { getCollection, type CollectionEntry } from 'astro:content';

/**
 * Devuelve la edicion marcada como `activa: true`. Si hay mas de una,
 * la primera por orden de carga; si no hay ninguna, la mas reciente.
 */
export async function obtenerEdicionActiva(): Promise<CollectionEntry<'ediciones'>> {
  const todas = await getCollection('ediciones');
  if (todas.length === 0) {
    throw new Error(
      'No hay ediciones definidas en src/content/ediciones/. ' +
        'Crea al menos un archivo JSON.',
    );
  }
  const activa = todas.find((e) => e.data.activa);
  if (activa) return activa;
  return todas.sort(
    (a, b) => b.data.fechaPublicacion.getTime() - a.data.fechaPublicacion.getTime(),
  )[0]!;
}

export async function obtenerArticulosDeEdicion(
  numero: string,
): Promise<CollectionEntry<'articulos'>[]> {
  const arts = await getCollection('articulos', ({ data }) => {
    return data.edicion === numero && !data.borrador;
  });
  return arts.sort((a, b) => a.data.orden - b.data.orden);
}

export async function obtenerArticulosPorSeccion(
  numero: string,
): Promise<Record<string, CollectionEntry<'articulos'>[]>> {
  const arts = await obtenerArticulosDeEdicion(numero);
  return arts.reduce(
    (acc, art) => {
      const s = art.data.seccion;
      (acc[s] ??= []).push(art);
      return acc;
    },
    {} as Record<string, CollectionEntry<'articulos'>[]>,
  );
}

export const tituloSeccion = (s: string): string => {
  const mapa: Record<string, string> = {
    editorial: 'Editorial',
    investigacion: 'Investigación',
    entrevista: 'Entrevistas',
    noticia: 'Noticias institucionales',
    proyecto: 'Proyectos académicos',
    evento: 'Eventos',
    galeria: 'Galerías',
    reconocimiento: 'Reconocimientos',
  };
  return mapa[s] ?? s;
};
