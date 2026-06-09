import { useStore } from '@nanostores/react';
import { $escalaFuente } from '@lib/store';

const ESCALAS = [0.9, 1.0, 1.15, 1.3] as const;

export default function SelectorFuente() {
  const escala = useStore($escalaFuente);
  const idx = Math.max(0, ESCALAS.indexOf(escala as (typeof ESCALAS)[number]));

  const bajar  = () => idx > 0                  && $escalaFuente.set(ESCALAS[idx - 1]!);
  const subir  = () => idx < ESCALAS.length - 1 && $escalaFuente.set(ESCALAS[idx + 1]!);

  return (
    <div className="control-grupo" role="group" aria-label="Tamaño de fuente">
      <button
        type="button"
        className="control-btn control-btn--icono"
        onClick={bajar}
        disabled={idx === 0}
        aria-label="Reducir tamaño de fuente"
      >
        A−
      </button>
      <span className="control-grupo__estado" aria-hidden="true">{Math.round(escala * 100)}%</span>
      <button
        type="button"
        className="control-btn control-btn--icono"
        onClick={subir}
        disabled={idx === ESCALAS.length - 1}
        aria-label="Aumentar tamaño de fuente"
      >
        A+
      </button>
    </div>
  );
}
