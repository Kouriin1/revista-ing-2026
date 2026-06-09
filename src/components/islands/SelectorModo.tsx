import { useStore } from '@nanostores/react';
import { $modoLectura } from '@lib/store';

const opciones = [
  { v: 'auto', l: 'Auto' },
  { v: 'scroll', l: 'Lectura' },
  { v: 'revista', l: 'Revista' },
] as const;

export default function SelectorModo() {
  const modo = useStore($modoLectura);
  const ciclar = () => {
    const idx = opciones.findIndex((o) => o.v === modo);
    const sig = opciones[(idx + 1) % opciones.length]!;
    $modoLectura.set(sig.v);
  };
  const actual = opciones.find((o) => o.v === modo) ?? opciones[0];

  return (
    <button
      type="button"
      className="control-btn"
      onClick={ciclar}
      aria-label={`Modo de lectura: ${actual.l}. Pulsa para cambiar`}
      title="Cambiar entre modo scroll y modo revista"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
      <span className="control-btn__txt">{actual.l}</span>
    </button>
  );
}
