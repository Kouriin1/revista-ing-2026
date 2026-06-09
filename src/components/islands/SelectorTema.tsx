import { useStore } from '@nanostores/react';
import { $tema } from '@lib/store';

const opciones = [
  { v: 'auto', l: 'Auto', i: '◐' },
  { v: 'claro', l: 'Claro', i: '☀' },
  { v: 'oscuro', l: 'Oscuro', i: '☾' },
] as const;

export default function SelectorTema() {
  const tema = useStore($tema);
  const ciclar = () => {
    const idx = opciones.findIndex((o) => o.v === tema);
    const sig = opciones[(idx + 1) % opciones.length]!;
    $tema.set(sig.v);
  };
  const actual = opciones.find((o) => o.v === tema) ?? opciones[0];

  return (
    <button
      type="button"
      className="control-btn"
      onClick={ciclar}
      aria-label={`Tema: ${actual.l}. Pulsa para cambiar`}
      title={`Tema: ${actual.l}`}
    >
      <span aria-hidden="true" style={{ fontSize: '1.1em' }}>{actual.i}</span>
      <span className="control-btn__txt">{actual.l}</span>
    </button>
  );
}
