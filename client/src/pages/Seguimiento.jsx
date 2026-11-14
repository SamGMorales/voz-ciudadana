import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { fechaHora } from '../utils';

export default function Seguimiento() {
  const [params] = useSearchParams();
  const [folio, setFolio] = useState(params.get('folio') || '');
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function buscar(e) {
    if (e) e.preventDefault();
    if (!folio.trim()) return setError('Escribe tu número de folio');
    setError('');
    setResultado(null);
    setCargando(true);
    try {
      setResultado(await api.seguimiento(folio.trim()));
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (params.get('folio')) buscar();
  }, []);

  return (
    <div className="seguimiento">
      <div className="tarjeta">
        <h1>Consultar mi reporte</h1>
        <p className="nota">Escribe el folio que recibiste al enviar tu reporte.</p>
        <form className="buscar-folio" onSubmit={buscar}>
          <input value={folio} onChange={e => setFolio(e.target.value)} placeholder="VC-2026-00001" />
          <button className="btn btn-primario" disabled={cargando}>{cargando ? 'Buscando...' : 'Consultar'}</button>
        </form>
        {error && <div className="alerta alerta-error">{error}</div>}
      </div>

      {resultado && (
        <div className="tarjeta">
          <div className="seg-encabezado">
            <div>
              <small>Folio</small>
              <h2>{resultado.folio}</h2>
              <p className="nota">{resultado.categoria} · {resultado.zona} · enviado el {fechaHora(resultado.fecha)}</p>
            </div>
            <span className={'estado estado-' + resultado.estado.replace(/\s/g, '').toLowerCase()}>{resultado.estado}</span>
          </div>

          {resultado.respuesta && (
            <div className="respuesta-muni">
              <small>Respuesta de la municipalidad</small>
              <p>{resultado.respuesta}</p>
            </div>
          )}

          <h3>Historial</h3>
          <ul className="linea-tiempo">
            {[...resultado.historial].reverse().map((h, i) => (
              <li key={i}>
                <strong>{h.estado}</strong>
                <span>{h.nota}</span>
                <small>{fechaHora(h.fecha)}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
