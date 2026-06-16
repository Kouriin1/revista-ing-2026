// Reproductor del sonido de la pagina.
// Carga el archivo de sonido una sola vez para usarlo rapido.

let instancia: HTMLAudioElement | null = null;

const obtenerAudio = (): HTMLAudioElement | null => {
  if (typeof window === 'undefined') return null;
  if (!instancia) {
    instancia = new Audio('/sonidos/page-turn.mp3');
    instancia.volume = 0.7; // Que tan fuerte suena
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
      // Ignora errores si el navegador bloquea el sonido
    });
  } catch {
    // Si algo sale mal no hace nada
  }
};
