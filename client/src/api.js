// Todas las llamadas al backend pasan por aqui
export function getToken() {
  try { return localStorage.getItem('token'); } catch (e) { return null; }
}

export function guardarSesion(token) {
  try { localStorage.setItem('token', token); } catch (e) { /* sin almacenamiento */ }
}

export function cerrarSesion() {
  try { localStorage.removeItem('token'); } catch (e) { /* sin almacenamiento */ }
}

async function peticion(url, opciones = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = 'Bearer ' + token;

  let res;
  try {
    res = await fetch('/api' + url, { ...opciones, headers });
  } catch (e) {
    throw new Error('No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.');
  }
  let datos = null;
  try { datos = await res.json(); } catch (e) { datos = null; }

  if (res.status === 401 && url.startsWith('/admin')) {
    cerrarSesion();
  }
  if (!res.ok) {
    const error = new Error((datos && datos.error) || 'Ocurrió un error, intenta de nuevo');
    error.status = res.status;
    throw error;
  }
  return datos;
}

function query(filtros) {
  const p = new URLSearchParams();
  Object.entries(filtros).forEach(([k, v]) => { if (v !== '' && v != null) p.append(k, v); });
  const s = p.toString();
  return s ? '?' + s : '';
}

export const api = {
  catalogos: () => peticion('/catalogos'),
  enviarQueja: datos => peticion('/quejas', { method: 'POST', body: JSON.stringify(datos) }),
  seguimiento: folio => peticion('/quejas/folio/' + encodeURIComponent(folio)),
  login: (correo, password) => peticion('/auth/login', { method: 'POST', body: JSON.stringify({ correo, password }) }),
  quejas: filtros => peticion('/admin/quejas' + query(filtros)),
  queja: id => peticion('/admin/quejas/' + id),
  estadisticas: () => peticion('/admin/estadisticas'),
  actualizar: (id, datos) => peticion('/admin/quejas/' + id, { method: 'PATCH', body: JSON.stringify(datos) }),
  reanalizar: id => peticion('/admin/quejas/' + id + '/analizar', { method: 'POST' })
};
