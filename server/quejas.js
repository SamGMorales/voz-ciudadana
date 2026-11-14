const express = require('express');
const db = require('./firebase');
const { soloAdmin } = require('./auth');
const { categorias, zonas, estados, prioridades } = require('./catalogos');
const { analizarQueja, UMBRAL_ETIQUETAS, UMBRAL_NEGATIVO, configurado } = require('./cognitivo');

const publico = express.Router();
const admin = express.Router();

const MAX_FOTO = 3 * 1024 * 1024; // la foto ya llega comprimida desde el navegador

function texto(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function validarQueja(b) {
  const errores = [];
  const nombre = texto(b.nombre, 100);
  const correo = texto(b.correo, 120);
  const telefono = texto(b.telefono, 20).replace(/[\s-]/g, '');
  const descripcion = texto(b.descripcion, 2000);

  if (!b.anonimo && nombre.length < 3) errores.push('Ingresa tu nombre completo');
  if (correo && !/^\S+@\S+\.\S+$/.test(correo)) errores.push('El correo no es válido');
  if (telefono && !/^[0-9]{8}$/.test(telefono)) errores.push('El teléfono debe tener 8 dígitos');
  if (!correo && !telefono && !b.anonimo) errores.push('Deja un correo o teléfono para contactarte');
  if (!categorias.includes(b.categoria)) errores.push('Selecciona una categoría válida');
  if (!zonas.includes(b.zona)) errores.push('Selecciona la zona');
  if (texto(b.direccion, 200).length < 5) errores.push('Escribe la dirección o referencia del lugar');
  if (descripcion.length < 20) errores.push('La descripción debe tener al menos 20 caracteres');

  if (!b.foto) {
    errores.push('Adjunta una fotografía del problema');
  } else if (typeof b.foto !== 'string' || !b.foto.startsWith('data:image/')) {
    errores.push('La fotografía no tiene un formato válido');
  } else if (b.foto.length > MAX_FOTO) {
    errores.push('La fotografía es muy pesada');
  }
  return errores;
}

// folio correlativo: VC-2026-00001
async function siguienteFolio() {
  const anio = new Date().getFullYear();
  const r = await db.ref('contadores/' + anio).transaction(n => (n || 0) + 1);
  return `VC-${anio}-${String(r.snapshot.val()).padStart(5, '0')}`;
}

// Corre los servicios de IA y guarda el resultado junto a la queja
async function procesarIA(id) {
  const ref = db.ref('quejas/' + id);
  try {
    const q = (await ref.once('value')).val();
    const foto = (await db.ref('fotos/' + id).once('value')).val();
    if (!q || !foto) return;
    await ref.update({ analisis: 'procesando' });

    const ia = await analizarQueja(q, foto);
    const cambios = { ia, analisis: ia.estado };
    // la prioridad sugerida solo se aplica si el personal no la cambio a mano
    if (!q.prioridadManual) cambios.prioridad = ia.prioridad;
    await ref.update(cambios);
    console.log(`IA ${q.folio}: ${ia.estado}`, Object.keys(ia.errores).length ? ia.errores : '');
  } catch (err) {
    console.error('Error procesando IA', id, err.message);
    await ref.update({ analisis: 'error' }).catch(() => {});
  }
}

// ---------- Rutas publicas (ciudadano) ----------

publico.get('/catalogos', (req, res) => {
  res.json({ categorias, zonas, estados, prioridades });
});

publico.post('/quejas', async (req, res) => {
  const b = req.body || {};
  const errores = validarQueja(b);
  if (errores.length) return res.status(400).json({ error: errores.join('. '), errores });

  try {
    const folio = await siguienteFolio();
    const ahora = Date.now();
    const ref = db.ref('quejas').push();

    await ref.set({
      folio,
      anonimo: !!b.anonimo,
      nombre: b.anonimo ? 'Anónimo' : texto(b.nombre, 100),
      correo: texto(b.correo, 120).toLowerCase(),
      telefono: texto(b.telefono, 20).replace(/[\s-]/g, ''),
      categoria: b.categoria,
      zona: b.zona,
      direccion: texto(b.direccion, 200),
      descripcion: texto(b.descripcion, 2000),
      miniatura: typeof b.miniatura === 'string' && b.miniatura.startsWith('data:image/') ? b.miniatura : b.foto,
      estado: 'Pendiente',
      prioridad: 'Media',
      fecha: ahora,
      actualizado: ahora,
      analisis: 'pendiente',
      historial: [{ estado: 'Pendiente', fecha: ahora, nota: 'Queja recibida' }]
    });
    // la foto completa va aparte para que el listado no pese tanto
    await db.ref('fotos/' + ref.key).set(b.foto);
    await db.ref('folios/' + folio).set(ref.key);

    res.status(201).json({ mensaje: 'Tu queja fue registrada correctamente', folio, fecha: ahora });

    // el analisis con IA corre despues de responder, para que el vecino no espere
    procesarIA(ref.key);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo registrar la queja, intenta de nuevo' });
  }
});

// seguimiento por folio: solo se muestra el estado, sin datos personales
publico.get('/quejas/folio/:folio', async (req, res) => {
  try {
    const folio = String(req.params.folio).trim().toUpperCase();
    const id = (await db.ref('folios/' + folio).once('value')).val();
    if (!id) return res.status(404).json({ error: 'No encontramos una queja con ese folio' });
    const q = (await db.ref('quejas/' + id).once('value')).val();
    res.json({
      folio: q.folio,
      categoria: q.categoria,
      zona: q.zona,
      estado: q.estado,
      fecha: q.fecha,
      actualizado: q.actualizado,
      respuesta: q.respuesta || '',
      historial: q.historial || []
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo consultar el folio' });
  }
});

// ---------- Rutas del panel (personal municipal) ----------

admin.use(soloAdmin);

admin.get('/quejas', async (req, res) => {
  try {
    const todas = (await db.ref('quejas').once('value')).val() || {};
    let lista = Object.entries(todas).map(([id, q]) => ({
      id,
      folio: q.folio,
      nombre: q.nombre,
      categoria: q.categoria,
      zona: q.zona,
      direccion: q.direccion,
      descripcion: q.descripcion,
      miniatura: q.miniatura,
      estado: q.estado,
      prioridad: q.prioridad,
      fecha: q.fecha,
      actualizado: q.actualizado,
      analisis: q.analisis || 'pendiente',
      sentimiento: q.ia && q.ia.sentimiento ? q.ia.sentimiento.sentimiento : null,
      negativo: q.ia && q.ia.sentimiento ? q.ia.sentimiento.negativo : null,
      critica: !!(q.ia && q.ia.sentimiento && q.ia.sentimiento.critica),
      area: q.ia && q.ia.gpt ? q.ia.gpt.area : null,
      resumen: q.ia && q.ia.gpt ? q.ia.gpt.resumen : null,
      palabrasClave: q.ia && q.ia.gpt ? q.ia.gpt.palabrasClave : [],
      etiquetas: q.ia && q.ia.imagen ? q.ia.imagen.etiquetas.map(t => t.nombre) : [],
      fotoCoincide: q.ia && q.ia.gpt ? q.ia.gpt.fotoCoincide : null,
      categoriaSugerida: q.ia && q.ia.gpt ? q.ia.gpt.categoriaSugerida : null
    }));

    const f = req.query;
    if (f.estado) lista = lista.filter(q => q.estado === f.estado);
    if (f.categoria) lista = lista.filter(q => q.categoria === f.categoria);
    if (f.zona) lista = lista.filter(q => q.zona === f.zona);
    if (f.prioridad) lista = lista.filter(q => q.prioridad === f.prioridad);
    if (f.desde) lista = lista.filter(q => q.fecha >= Number(f.desde));
    if (f.hasta) lista = lista.filter(q => q.fecha <= Number(f.hasta));
    if (f.sentimiento) lista = lista.filter(q => q.sentimiento === f.sentimiento);
    if (f.area) lista = lista.filter(q => q.area === f.area);
    if (f.critica === '1') lista = lista.filter(q => q.critica);
    if (f.etiqueta) lista = lista.filter(q => q.etiquetas.includes(f.etiqueta));
    if (f.q) {
      const t = f.q.toLowerCase();
      lista = lista.filter(q => `${q.folio} ${q.nombre} ${q.descripcion} ${q.direccion} ${(q.palabrasClave || []).join(' ')} ${q.etiquetas.join(' ')} ${q.resumen || ''}`.toLowerCase().includes(t));
    }

    const peso = { Alta: 0, Media: 1, Baja: 2 };
    if (f.orden === 'antiguas') lista.sort((a, b) => a.fecha - b.fecha);
    else if (f.orden === 'prioridad') lista.sort((a, b) => peso[a.prioridad] - peso[b.prioridad] || (b.negativo || 0) - (a.negativo || 0) || b.fecha - a.fecha);
    else lista.sort((a, b) => b.fecha - a.fecha);
    res.json(lista);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudieron cargar las quejas' });
  }
});

admin.get('/estadisticas', async (req, res) => {
  try {
    const todas = Object.values((await db.ref('quejas').once('value')).val() || {});
    const contar = campo => todas.reduce((acc, q) => ({ ...acc, [q[campo]]: (acc[q[campo]] || 0) + 1 }), {});
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    res.json({
      total: todas.length,
      hoy: todas.filter(q => q.fecha >= hoy.getTime()).length,
      porEstado: contar('estado'),
      porCategoria: contar('categoria'),
      porZona: contar('zona'),
      porPrioridad: contar('prioridad'),
      porSentimiento: todas.reduce((acc, q) => {
        const s = q.ia && q.ia.sentimiento ? q.ia.sentimiento.sentimiento : 'sin analizar';
        return { ...acc, [s]: (acc[s] || 0) + 1 };
      }, {}),
      porArea: todas.reduce((acc, q) => {
        if (!(q.ia && q.ia.gpt)) return acc;
        return { ...acc, [q.ia.gpt.area]: (acc[q.ia.gpt.area] || 0) + 1 };
      }, {}),
      criticas: todas.filter(q => q.ia && q.ia.sentimiento && q.ia.sentimiento.critica && q.estado !== 'Resuelta').length,
      etiquetas: todas.reduce((acc, q) => {
        (q.ia && q.ia.imagen ? q.ia.imagen.etiquetas : []).forEach(t => { acc[t.nombre] = (acc[t.nombre] || 0) + 1; });
        return acc;
      }, {}),
      config: {
        umbralEtiquetas: UMBRAL_ETIQUETAS,
        umbralNegativo: UMBRAL_NEGATIVO,
        servicios: { sentimiento: configurado('sentimiento'), imagen: configurado('vision'), gpt: configurado('gpt') }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudieron calcular las estadísticas' });
  }
});

admin.get('/quejas/:id', async (req, res) => {
  try {
    const q = (await db.ref('quejas/' + req.params.id).once('value')).val();
    if (!q) return res.status(404).json({ error: 'Queja no encontrada' });
    const foto = (await db.ref('fotos/' + req.params.id).once('value')).val();
    res.json({ id: req.params.id, ...q, foto });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo cargar la queja' });
  }
});

// cambiar estado / prioridad / responder al ciudadano
admin.patch('/quejas/:id', async (req, res) => {
  const { estado, prioridad, nota, respuesta } = req.body || {};
  if (estado !== undefined && !estados.includes(estado)) {
    return res.status(400).json({ error: 'Estado no válido' });
  }
  if (prioridad !== undefined && !prioridades.includes(prioridad)) {
    return res.status(400).json({ error: 'Prioridad no válida' });
  }

  try {
    const ref = db.ref('quejas/' + req.params.id);
    const q = (await ref.once('value')).val();
    if (!q) return res.status(404).json({ error: 'Queja no encontrada' });

    const ahora = Date.now();
    const cambios = { actualizado: ahora };
    if (prioridad) {
      cambios.prioridad = prioridad;
      cambios.prioridadManual = true;
    }
    if (respuesta !== undefined) cambios.respuesta = texto(respuesta, 1000);

    const historial = q.historial || [];
    if (estado && estado !== q.estado) {
      cambios.estado = estado;
      historial.push({ estado, fecha: ahora, nota: texto(nota, 300) || 'Cambio de estado' });
      cambios.historial = historial;
    } else if (nota && texto(nota, 300)) {
      historial.push({ estado: q.estado, fecha: ahora, nota: texto(nota, 300) });
      cambios.historial = historial;
    }

    await ref.update(cambios);
    res.json({ mensaje: 'Queja actualizada', ...cambios });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo actualizar la queja' });
  }
});

// volver a correr la IA (por ejemplo si un servicio fallo)
admin.post('/quejas/:id/analizar', async (req, res) => {
  const q = (await db.ref('quejas/' + req.params.id).once('value')).val();
  if (!q) return res.status(404).json({ error: 'Queja no encontrada' });
  await procesarIA(req.params.id);
  const nueva = (await db.ref('quejas/' + req.params.id).once('value')).val();
  res.json({ mensaje: 'Análisis actualizado', analisis: nueva.analisis, ia: nueva.ia, prioridad: nueva.prioridad });
});

// al arrancar, termina las quejas que quedaron sin analizar (Render apaga el servidor cuando no hay uso)
async function procesarPendientes() {
  const todas = (await db.ref('quejas').once('value')).val() || {};
  for (const [id, q] of Object.entries(todas)) {
    if (q.analisis === 'pendiente' || q.analisis === 'procesando') await procesarIA(id);
  }
}

module.exports = { publico, admin, procesarPendientes };
