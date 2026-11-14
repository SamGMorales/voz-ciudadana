import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { fechaHora, porcentaje } from '../utils';
import { BadgeEstado, BadgePrioridad, BadgeSentimiento, BadgeAnalisis } from '../components/Etiquetas';

const filtrosVacios = {
  q: '', estado: '', categoria: '', zona: '', prioridad: '', sentimiento: '', area: '', etiqueta: '', critica: '', orden: 'prioridad'
};

function Barras({ titulo, datos, total, onElegir, nombres = {} }) {
  const filas = Object.entries(datos || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return (
    <div className="tarjeta grafica">
      <h3>{titulo}</h3>
      {filas.length === 0 ? <p className="nota">Sin datos todavía</p> : filas.map(([k, v]) => (
        <button key={k} className="barra-fila" onClick={() => onElegir && onElegir(k)} type="button">
          <span className="barra-nombre">{nombres[k] || k}</span>
          <span className="barra-fondo"><span className="barra-relleno" style={{ width: (total ? (v / total) * 100 : 0) + '%' }} /></span>
          <b>{v}</b>
        </button>
      ))}
    </div>
  );
}

export default function Panel() {
  const navigate = useNavigate();
  const [catalogos, setCatalogos] = useState(null);
  const [stats, setStats] = useState(null);
  const [quejas, setQuejas] = useState([]);
  const [filtros, setFiltros] = useState(filtrosVacios);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  function manejarError(e) {
    if (e.status === 401) navigate('/admin/login');
    else setError(e.message);
  }

  function cargar() {
    setError('');
    api.quejas(filtros).then(setQuejas).catch(manejarError).finally(() => setCargando(false));
    api.estadisticas().then(setStats).catch(manejarError);
  }

  useEffect(() => { api.catalogos().then(setCatalogos).catch(() => {}); }, []);

  useEffect(() => {
    const t = setTimeout(cargar, filtros.q ? 350 : 0);
    return () => clearTimeout(t);
  }, [filtros]);

  // se actualiza solo cada 30 segundos para ver quejas nuevas y analisis terminados
  useEffect(() => {
    const t = setInterval(cargar, 30000);
    return () => clearInterval(t);
  }, [filtros]);

  function cambiar(e) {
    setFiltros({ ...filtros, [e.target.name]: e.target.value });
  }

  function poner(campo, valor) {
    setFiltros({ ...filtros, [campo]: filtros[campo] === valor ? '' : valor });
  }

  const hayFiltros = Object.entries(filtros).some(([k, v]) => k !== 'orden' && v !== '');
  const pe = (stats && stats.porEstado) || {};
  const ps = (stats && stats.porSentimiento) || {};
  const analizadas = stats ? stats.total - (ps['sin analizar'] || 0) : 0;
  const etiquetasTop = stats ? Object.entries(stats.etiquetas).sort((a, b) => b[1] - a[1]).slice(0, 12) : [];

  return (
    <div className="panel">
      <div className="titulo-pagina">
        <div>
          <h1>Panel de administración municipal</h1>
          <p className="nota">Quejas y reportes ciudadanos · se actualiza cada 30 segundos</p>
        </div>
        <button className="btn btn-borde" onClick={cargar}>↻ Actualizar</button>
      </div>

      {stats && (
        <>
          <div className="indicadores">
            <div className="indicador"><small>Total de reportes</small><strong>{stats.total}</strong><span>{stats.hoy} recibidos hoy</span></div>
            <button className="indicador ind-pendiente" onClick={() => poner('estado', 'Pendiente')}><small>Pendientes</small><strong>{pe['Pendiente'] || 0}</strong><span>sin atender</span></button>
            <button className="indicador ind-proceso" onClick={() => poner('estado', 'En proceso')}><small>En proceso</small><strong>{(pe['En proceso'] || 0) + (pe['En revisión'] || 0)}</strong><span>en revisión o proceso</span></button>
            <button className="indicador ind-resuelta" onClick={() => poner('estado', 'Resuelta')}><small>Resueltas</small><strong>{pe['Resuelta'] || 0}</strong><span>{stats.total ? porcentaje((pe['Resuelta'] || 0) / stats.total) : '0%'} del total</span></button>
            <button className="indicador ind-critica" onClick={() => poner('critica', '1')}><small>Críticas abiertas</small><strong>{stats.criticas}</strong><span>texto muy negativo (≥ {porcentaje(stats.config.umbralNegativo)})</span></button>
          </div>

          <div className="graficas">
            <Barras titulo="Sentimiento de los ciudadanos" datos={ps} total={stats.total}
              onElegir={k => k !== 'sin analizar' && poner('sentimiento', k)}
              nombres={{ negative: 'Negativo', neutral: 'Neutral', positive: 'Positivo', mixed: 'Mixto', 'sin analizar': 'Sin analizar' }} />
            <Barras titulo="Área sugerida por IA" datos={stats.porArea} total={analizadas} onElegir={k => poner('area', k)} />
            <Barras titulo="Por categoría" datos={stats.porCategoria} total={stats.total} onElegir={k => poner('categoria', k)} />
          </div>

          {etiquetasTop.length > 0 && (
            <div className="tarjeta nube">
              <h3>Lo que más aparece en las fotos <small className="nota">(etiquetas con confianza ≥ {porcentaje(stats.config.umbralEtiquetas)})</small></h3>
              <div className="chips">
                {etiquetasTop.map(([t, n]) => (
                  <button key={t} className={'chip' + (filtros.etiqueta === t ? ' activo' : '')} onClick={() => poner('etiqueta', t)}>{t} <b>{n}</b></button>
                ))}
              </div>
            </div>
          )}

          {Object.values(stats.config.servicios).some(v => !v) && (
            <div className="alerta alerta-aviso">
              Servicios de IA sin configurar: {Object.entries(stats.config.servicios).filter(([, v]) => !v).map(([k]) => k).join(', ')}. Revisa las variables de entorno del servidor.
            </div>
          )}
        </>
      )}

      <div className="tarjeta filtros">
        <input name="q" value={filtros.q} onChange={cambiar} placeholder="Buscar por folio, nombre, texto, palabra clave o etiqueta..." className="buscador" />
        <div className="filtros-fila">
          <select name="estado" value={filtros.estado} onChange={cambiar}>
            <option value="">Todos los estados</option>
            {catalogos && catalogos.estados.map(x => <option key={x}>{x}</option>)}
          </select>
          <select name="prioridad" value={filtros.prioridad} onChange={cambiar}>
            <option value="">Toda prioridad</option>
            {catalogos && catalogos.prioridades.map(x => <option key={x}>{x}</option>)}
          </select>
          <select name="categoria" value={filtros.categoria} onChange={cambiar}>
            <option value="">Todas las categorías</option>
            {catalogos && catalogos.categorias.map(x => <option key={x}>{x}</option>)}
          </select>
          <select name="zona" value={filtros.zona} onChange={cambiar}>
            <option value="">Todas las zonas</option>
            {catalogos && catalogos.zonas.map(x => <option key={x}>{x}</option>)}
          </select>
          <select name="sentimiento" value={filtros.sentimiento} onChange={cambiar}>
            <option value="">Todo sentimiento</option>
            <option value="negative">Negativo</option>
            <option value="neutral">Neutral</option>
            <option value="positive">Positivo</option>
            <option value="mixed">Mixto</option>
          </select>
          <select name="orden" value={filtros.orden} onChange={cambiar}>
            <option value="prioridad">Ordenar: más urgentes</option>
            <option value="recientes">Ordenar: más recientes</option>
            <option value="antiguas">Ordenar: más antiguas</option>
          </select>
          {hayFiltros && <button className="btn btn-borde btn-sm" onClick={() => setFiltros({ ...filtrosVacios, orden: filtros.orden })}>Limpiar filtros</button>}
        </div>
        {(filtros.area || filtros.etiqueta || filtros.critica) && (
          <p className="nota">
            Filtro activo: {filtros.area && <b>área "{filtros.area}" </b>}{filtros.etiqueta && <b>etiqueta "{filtros.etiqueta}" </b>}{filtros.critica && <b>solo críticas</b>}
          </p>
        )}
      </div>

      {error && <div className="alerta alerta-error">{error}</div>}

      <p className="nota">{quejas.length} {quejas.length === 1 ? 'reporte' : 'reportes'}</p>

      {cargando ? <p className="vacio">Cargando reportes...</p> : quejas.length === 0 ? (
        <p className="vacio">No hay reportes con estos filtros.</p>
      ) : (
        <div className="lista-quejas">
          {quejas.map(q => (
            <Link key={q.id} to={'/admin/queja/' + q.id} className={'fila-queja' + (q.critica ? ' es-critica' : '')}>
              <img src={q.miniatura} alt="" />
              <div className="fila-info">
                <div className="fila-arriba">
                  <b>{q.folio}</b>
                  <BadgeEstado estado={q.estado} />
                  <BadgePrioridad prioridad={q.prioridad} />
                  <BadgeSentimiento sentimiento={q.sentimiento} critica={q.critica} />
                  {q.analisis !== 'completo' && <BadgeAnalisis analisis={q.analisis} />}
                  {q.fotoCoincide === false && <span className="aviso-mini">⚠ foto no coincide</span>}
                </div>
                <h3>{q.resumen || q.descripcion.slice(0, 140) + (q.descripcion.length > 140 ? '...' : '')}</h3>
                <p className="nota">
                  {q.categoria} · {q.zona} · {q.direccion}{q.area && <> · <b>{q.area}</b></>}
                </p>
                {q.etiquetas.length > 0 && (
                  <div className="mini-etiquetas">{q.etiquetas.slice(0, 5).map(t => <span key={t}>{t}</span>)}</div>
                )}
              </div>
              <div className="fila-fecha">
                <small>{fechaHora(q.fecha)}</small>
                <small>{q.nombre}</small>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
