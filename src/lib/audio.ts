/**
 * Reproductor minimalista del sonido de pasar pagina.
 * Usa un solo Audio reutilizable. Si el archivo no existe o el usuario
 * desactivo el sonido, falla silenciosamente.
 */

let instancia: HTMLAudioElement | null = null;

const obtenerAudio = (): HTMLAudioElement | null => {
  if (typeof window === 'undefined') return null;
  if (!instancia) {
    instancia = new Audio('/sonidos/page-turn.mp3');
    instancia.volume = 0.35;
    instancia.preload = 'auto';
  }
  return instancia;
};

export const reproducirPaginaPasada = (activo: boolean): void => {
  if (!activo) return;
  const audio = obtenerAudio();
  if (!audio) return;
  try {
    audio.currentTime = 0;
    void audio.play().catch(() => {
      /* algunos navegadores bloquean autoplay; ignoramos */
    });
  } catch {
    /* sin sonido */
  }
};
