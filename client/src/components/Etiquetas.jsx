import { nombreSentimiento, claseSentimiento } from '../utils';

export function BadgeEstado({ estado }) {
  return <span className={'estado estado-' + estado.replace(/\s/g, '').toLowerCase()}>{estado}</span>;
}

export function BadgePrioridad({ prioridad }) {
  return <span className={'prioridad prioridad-' + prioridad.toLowerCase()}>{prioridad}</span>;
}

export function BadgeSentimiento({ sentimiento, critica }) {
  if (!sentimiento) return <span className="sent sent-sin">Sin analizar</span>;
  return (
    <span className={'sent sent-' + claseSentimiento(sentimiento)}>
      {nombreSentimiento[sentimiento] || sentimiento}{critica ? ' · crítica' : ''}
    </span>
  );
}

export function BadgeAnalisis({ analisis }) {
  const textos = { pendiente: 'IA pendiente', procesando: 'Analizando...', completo: 'IA completa', parcial: 'IA parcial', error: 'IA con error' };
  return <span className={'ia ia-' + analisis}>{textos[analisis] || analisis}</span>;
}
