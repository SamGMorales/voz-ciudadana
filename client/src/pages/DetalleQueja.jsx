import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { fechaHora, porcentaje, nombreSentimiento, claseSentimiento } from '../utils';
import { BadgeEstado, BadgePrioridad, BadgeAnalisis } from '../components/Etiquetas';

export default function DetalleQueja() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [q, setQ] = useState(null);
  const [catalogos, setCatalogos] = useState(null);
  const [gestion, setGestion] = useState({ estado: '', prioridad: '', nota: '', respuesta: '' });
  const [mensaje, setMensaje] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [fotoGrande, setFotoGrande] = useState(false);

  function manejarError(e) {
    if (e.status === 401) navigate('/admin/login');
    else setMensaje({ tipo: 'error', texto: e.message });
  }

  function cargar() {
    return api.queja(id).then(d => {
      setQ(d);
      setGestion({ estado: d.estado, prioridad: d.prioridad, nota: '', respuesta: d.respuesta || '' });
    }).catch(manejarError);
  }

  useEffect(() => {
    cargar();
    api.catalogos().then(setCatalogos);
  }, [id]);

  // si la IA sigue trabajando, vuelve a consultar
  useEffect(() => {
    if (!q || !['pendiente', 'procesando'].includes(q.analisis)) return;
    const t = setTimeout(cargar, 4000);
    return () => clearTimeout(t);
  }, [q]);

  async function guardar(e) {
    e.preventDefault();
    setMensaje(null);
    setGuardando(true);
    try {
      const datos = { nota: gestion.nota, respuesta: gestion.respuesta };
      if (gestion.estado !== q.estado) datos.estado = gestion.estado;
      if (gestion.prioridad !== q.prioridad) datos.prioridad = gestion.prioridad;
      await api.actualizar(id, datos);
      setMensaje({ tipo: 'exito', texto: 'Cambios guardados' });
      await cargar();
    } catch (err) {
      manejarError(err);
    } finally {
      setGuardando(false);
    }
  }

  async function reanalizar() {
    setAnalizando(true);
    setMensaje(null);
    try {
      await api.reanalizar(id);
      await cargar();
      setMensaje({ tipo: 'exito', texto: 'Análisis de IA actualizado' });
    } catch (err) {
      manejarError(err);
    } finally {
      setAnalizando(false);
    }
  }

  if (!q) return <p className="vacio">{mensaje ? mensaje.texto : 'Cargando reporte...'}</p>;

  const ia = q.ia || {};
  const s = ia.sentimiento;
  const img = ia.imagen;
  const gpt = ia.gpt;
  const errores = ia.errores || {};

  return (
    <div className="detalle">
      <Link to="/admin" className="volver">← Volver al panel</Link>

      <div className="titulo-pagina">
        <div>
          <small className="nota">Reporte</small>
          <h1>{q.folio}</h1>
          <div className="fila-arriba">
            <BadgeEstado estado={q.estado} />
            <BadgePrioridad prioridad={q.prioridad} />
            <BadgeAnalisis analisis={q.analisis || 'pendiente'} />
            <span className="nota">{q.categoria} · {q.zona} · {fechaHora(q.fecha)}</span>
          </div>
        </div>
        <button className="btn btn-borde" onClick={reanalizar} disabled={analizando}>
          {analizando ? 'Analizando...' : '🤖 Volver a analizar con IA'}
        </button>
      </div>

      {mensaje && <div className={'alerta alerta-' + mensaje.tipo}>{mensaje.texto}</div>}

      <div className="detalle-grid">
        <div>
          <div className="tarjeta">
            <h2>Reporte del ciudadano</h2>
            <img className="foto-detalle" src={q.foto || q.miniatura} alt="Fotografía del reporte" onClick={() => setFotoGrande(true)} />
            <h3>Descripción original</h3>
            <p className="descripcion">{q.descripcion}</p>
            <dl className="datos">
              <div><dt>Dirección</dt><dd>{q.direccion}</dd></div>
              <div><dt>Ciudadano</dt><dd>{q.nombre}</dd></div>
              <div><dt>Correo</dt><dd>{q.correo || '—'}</dd></div>
              <div><dt>Teléfono</dt><dd>{q.telefono || '—'}</dd></div>
            </dl>
          </div>

          <div className="tarjeta ia-panel">
            <h2>Análisis con inteligencia artificial</h2>
            {['pendiente', 'procesando'].includes(q.analisis) && <p className="nota">La IA está analizando este reporte...</p>}

            {gpt && (
              <div className="ia-bloque ia-gpt">
                <h3>Resumen e interpretación (GPT)</h3>
                <p className="resumen">{gpt.resumen}</p>
                <div className="ia-datos">
                  <div><small>Área sugerida</small><b>{gpt.area}</b></div>
                  <div><small>Prioridad sugerida</small><b>{gpt.prioridad}</b></div>
                  <div><small>Categoría sugerida</small><b>{gpt.categoriaSugerida || '—'}</b>
                    {gpt.categoriaSugerida && gpt.categoriaSugerida !== q.categoria && <span className="aviso-mini">distinta a la que eligió el vecino</span>}
                  </div>
                </div>
                {gpt.motivoPrioridad && <p className="nota"><b>¿Por qué?</b> {gpt.motivoPrioridad}</p>}
                {gpt.recomendaciones.length > 0 && (
                  <>
                    <h4>Recomendaciones</h4>
                    <ul>{gpt.recomendaciones.map((r, i) => <li key={i}>{r}</li>)}</ul>
                  </>
                )}
                {gpt.palabrasClave.length > 0 && (
                  <div className="mini-etiquetas">{gpt.palabrasClave.map(p => <span key={p}>#{p}</span>)}</div>
                )}
                <div className={'coincide ' + (gpt.fotoCoincide ? 'si' : 'no')}>
                  {gpt.fotoCoincide ? '✓ La foto respalda el reporte' : '⚠ La foto podría no corresponder al reporte'}
                  {gpt.relacionTextoImagen && <small>{gpt.relacionTextoImagen}</small>}
                </div>
              </div>
            )}
            {errores.gpt && <p className="alerta alerta-error">GPT: {errores.gpt}</p>}

            {s && (
              <div className="ia-bloque">
                <h3>Sentimiento del texto</h3>
                <p>
                  Resultado: <span className={'sent sent-' + claseSentimiento(s.sentimiento)}>{nombreSentimiento[s.sentimiento] || s.sentimiento}</span>
                  {s.critica && <b className="critica"> · Queja crítica</b>}
                </p>
                {[['positivo', 'Positivo', 'pos'], ['neutral', 'Neutral', 'neu'], ['negativo', 'Negativo', 'neg']].map(([k, n, c]) => (
                  <div key={k} className="confianza">
                    <span>{n}</span>
                    <span className="barra-fondo"><span className={'barra-relleno relleno-' + c} style={{ width: porcentaje(s[k]) }} /></span>
                    <b>{porcentaje(s[k])}</b>
                  </div>
                ))}
                <p className="nota">Uso: si la confianza negativa llega al umbral, la queja se marca como crítica y nunca queda con prioridad baja.</p>
              </div>
            )}
            {errores.sentimiento && <p className="alerta alerta-error">Sentimiento: {errores.sentimiento}</p>}

            {img && (
              <div className="ia-bloque">
                <h3>Análisis de la imagen</h3>
                <p><b>Descripción:</b> {img.descripcion || '—'} {img.confianzaDescripcion ? <span className="nota">({porcentaje(img.confianzaDescripcion)} de confianza)</span> : null}</p>
                <p className="nota">Criterio: solo se usan las etiquetas con confianza mayor o igual a <b>{porcentaje(img.umbral)}</b>.</p>
                <div className="tabla-etiquetas">
                  {img.etiquetas.map(t => (
                    <div key={t.nombre} className="etiq usada"><span>✓ {t.nombre}</span><b>{porcentaje(t.confianza)}</b></div>
                  ))}
                  {img.descartadas.map(t => (
                    <div key={t.nombre} className="etiq descartada"><span>✕ {t.nombre}</span><b>{porcentaje(t.confianza)}</b></div>
                  ))}
                </div>
                {img.fotoPocoClara && <p className="aviso-mini">Ninguna etiqueta pasó el umbral: la foto puede no ser clara.</p>}
              </div>
            )}
            {errores.imagen && <p className="alerta alerta-error">Imagen: {errores.imagen}</p>}
          </div>
        </div>

        <aside>
          <form className="tarjeta gestion" onSubmit={guardar}>
            <h2>Gestión del reporte</h2>
            <label>Estado
              <select value={gestion.estado} onChange={e => setGestion({ ...gestion, estado: e.target.value })}>
                {catalogos && catalogos.estados.map(x => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label>Prioridad
              <select value={gestion.prioridad} onChange={e => setGestion({ ...gestion, prioridad: e.target.value })}>
                {catalogos && catalogos.prioridades.map(x => <option key={x}>{x}</option>)}
              </select>
              {!q.prioridadManual && ia.prioridad && <small className="nota">Asignada automáticamente por la IA</small>}
            </label>
            <label>Nota interna (queda en el historial)
              <textarea rows="2" value={gestion.nota} onChange={e => setGestion({ ...gestion, nota: e.target.value })} placeholder="Ej: Se envió cuadrilla" />
            </label>
            <label>Respuesta para el ciudadano
              <textarea rows="3" value={gestion.respuesta} onChange={e => setGestion({ ...gestion, respuesta: e.target.value })} placeholder="El vecino la verá al consultar su folio" />
            </label>
            <button className="btn btn-primario btn-bloque" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar cambios'}</button>
          </form>

          <div className="tarjeta">
            <h2>Historial</h2>
            <ul className="linea-tiempo">
              {[...(q.historial || [])].reverse().map((h, i) => (
                <li key={i}><strong>{h.estado}</strong><span>{h.nota}</span><small>{fechaHora(h.fecha)}</small></li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {fotoGrande && (
        <div className="modal" onClick={() => setFotoGrande(false)}>
          <img src={q.foto} alt="Foto ampliada" />
        </div>
      )}
    </div>
  );
}
