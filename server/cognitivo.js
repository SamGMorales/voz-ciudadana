// Conexion con los 3 servicios cognitivos del curso.
// Las URL y llaves van en variables de entorno (Render), nunca en el codigo ni en el frontend.
const { prioridades } = require('./catalogos');

const cfg = {
  sentimiento: {
    url: process.env.SENTIMIENTO_URL || 'https://demoanalisissentimiento.cognitiveservices.azure.com/text/analytics/v3.1/sentiment?language=es',
    key: process.env.SENTIMIENTO_KEY,
    header: process.env.SENTIMIENTO_HEADER || 'Ocp-Apim-Subscription-Key'
  },
  vision: {
    url: process.env.VISION_URL || 'https://democomputervisionumg.cognitiveservices.azure.com/vision/v3.2/analyze?visualFeatures=Description,Tags&language=es',
    key: process.env.VISION_KEY,
    header: process.env.VISION_HEADER || 'Ocp-Apim-Subscription-Key'
  },
  gpt: {
    url: process.env.GPT_URL || 'https://demo-gpt.openai.azure.com/openai/deployments/gpt-4.1/chat/completions?api-version=2023-10-01-preview',
    key: process.env.GPT_KEY,
    header: process.env.GPT_HEADER || 'api-key',
    modelo: process.env.GPT_MODELO || ''
  }
};

// Etiquetas de la foto con menos confianza que esto se descartan (0.70 = 70%)
const UMBRAL_ETIQUETAS = Number(process.env.UMBRAL_ETIQUETAS || 0.7);
// Si el texto es negativo con esta confianza o mas, se considera queja "critica"
const UMBRAL_NEGATIVO = Number(process.env.UMBRAL_NEGATIVO || 0.8);

// las URL de los servicios del curso ya vienen por defecto, solo falta la llave
function configurado(servicio) {
  return !!(cfg[servicio].url && cfg[servicio].key);
}

async function llamar(servicio, body, contentType = 'application/json') {
  const c = cfg[servicio];
  const headers = { 'Content-Type': contentType };
  if (c.key) {
    headers[c.header] = c.header.toLowerCase() === 'authorization' ? 'Bearer ' + c.key : c.key;
  }
  const res = await fetch(c.url, { method: 'POST', headers, body, signal: AbortSignal.timeout(30000) });
  const txt = await res.text();
  let datos;
  try { datos = JSON.parse(txt); } catch (e) { datos = txt; }
  if (!res.ok) {
    const msg = (datos && datos.error && (datos.error.message || datos.error)) || txt.slice(0, 200);
    throw new Error(`${servicio} respondió ${res.status}: ${msg}`);
  }
  return datos;
}

// ---------------- A. Sentimiento ----------------
async function analizarSentimiento(texto) {
  const documento = { id: '1', language: 'es', text: texto.slice(0, 5000) };
  // v3.1 (el que se uso en clase) o la version nueva de Azure Language
  const body = cfg.sentimiento.url.includes('analyze-text')
    ? { kind: 'SentimentAnalysis', analysisInput: { documents: [documento] } }
    : { documents: [documento] };
  const datos = await llamar('sentimiento', JSON.stringify(body));

  // formato de Azure Language (o uno parecido que devuelva el servicio del curso)
  const doc = (datos.results && datos.results.documents && datos.results.documents[0])
    || (datos.documents && datos.documents[0]) || datos;
  const s = doc.confidenceScores || doc.confianza || {};
  const resultado = {
    sentimiento: String(doc.sentiment || doc.sentimiento || '').toLowerCase(),
    positivo: Number(s.positive ?? s.positivo ?? 0),
    neutral: Number(s.neutral ?? 0),
    negativo: Number(s.negative ?? s.negativo ?? 0)
  };
  if (!resultado.sentimiento) throw new Error('El servicio de sentimiento no devolvió un resultado reconocible');

  // como se usa: una queja muy negativa se marca como critica para atenderla primero
  resultado.critica = resultado.negativo >= UMBRAL_NEGATIVO;
  return resultado;
}

// ---------------- B. Imagen ----------------
async function analizarImagen(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const datos = await llamar('vision', Buffer.from(base64, 'base64'), 'application/octet-stream');

  // Azure Vision 4.0 (captionResult / tagsResult) o 3.2 (description / tags)
  let descripcion = '';
  let confianzaDescripcion = 0;
  if (datos.captionResult) {
    descripcion = datos.captionResult.text;
    confianzaDescripcion = datos.captionResult.confidence;
  } else if (datos.description && datos.description.captions && datos.description.captions[0]) {
    descripcion = datos.description.captions[0].text;
    confianzaDescripcion = datos.description.captions[0].confidence;
  }

  const crudas = (datos.tagsResult && datos.tagsResult.values) || datos.tags || [];
  const todas = crudas
    .map(t => ({ nombre: t.name || t.nombre, confianza: Number(t.confidence ?? t.confianza ?? 0) }))
    .filter(t => t.nombre)
    .sort((a, b) => b.confianza - a.confianza);

  // criterio: solo se usan las etiquetas que pasan el umbral
  const confiables = todas.filter(t => t.confianza >= UMBRAL_ETIQUETAS);

  return {
    descripcion,
    confianzaDescripcion,
    umbral: UMBRAL_ETIQUETAS,
    etiquetas: confiables,
    descartadas: todas.filter(t => t.confianza < UMBRAL_ETIQUETAS),
    fotoPocoClara: confiables.length === 0
  };
}

// ---------------- C. GPT ----------------
const AREAS = [
  'Servicios Públicos', 'Obras y Mantenimiento Vial', 'Limpieza y Desechos Sólidos',
  'Agua y Saneamiento', 'Policía Municipal', 'Medio Ambiente y Áreas Verdes',
  'Tránsito y Movilidad', 'Atención al Vecino'
];

function construirPrompt(q, sentimiento, imagen) {
  return `Eres un asistente del departamento de atención ciudadana de una municipalidad en Guatemala.
Analiza este reporte de un vecino y responde SOLO con un objeto JSON válido, sin texto adicional.

Reporte:
- Categoría elegida por el vecino: ${q.categoria}
- Zona: ${q.zona}
- Dirección: ${q.direccion}
- Descripción: """${q.descripcion}"""
- Sentimiento del texto: ${sentimiento ? `${sentimiento.sentimiento} (negativo ${Math.round(sentimiento.negativo * 100)}%)` : 'no disponible'}
- Lo que se ve en la foto: ${imagen ? (imagen.descripcion || 'sin descripción') : 'no disponible'}
- Etiquetas confiables de la foto: ${imagen && imagen.etiquetas.length ? imagen.etiquetas.map(t => t.nombre).join(', ') : 'ninguna'}

Formato de respuesta:
{
  "resumen": "resumen del problema en una o dos oraciones",
  "categoria_sugerida": "una de: Alumbrado público, Baches y calles, Basura y limpieza, Agua potable, Drenajes, Seguridad, Ruido, Parques y áreas verdes, Tránsito, Otro",
  "prioridad": "Baja, Media o Alta",
  "motivo_prioridad": "por qué esa prioridad",
  "area_atencion": "una de: ${AREAS.join(', ')}",
  "recomendaciones": ["acción concreta 1", "acción concreta 2"],
  "palabras_clave": ["palabra1", "palabra2", "palabra3"],
  "foto_coincide": true,
  "relacion_texto_imagen": "explica si la foto respalda lo que describe el vecino"
}`;
}

function extraerJson(texto) {
  const inicio = texto.indexOf('{');
  const fin = texto.lastIndexOf('}');
  if (inicio === -1 || fin === -1) throw new Error('GPT no devolvió un JSON');
  return JSON.parse(texto.slice(inicio, fin + 1));
}

async function consultarGpt(q, sentimiento, imagen) {
  const body = {
    messages: [
      { role: 'system', content: 'Respondes únicamente con JSON válido en español.' },
      { role: 'user', content: construirPrompt(q, sentimiento, imagen) }
    ],
    temperature: 0.2,
    max_tokens: 700
  };
  if (cfg.gpt.modelo) body.model = cfg.gpt.modelo;

  const datos = await llamar('gpt', JSON.stringify(body));
  const contenido = (datos.choices && datos.choices[0] && datos.choices[0].message && datos.choices[0].message.content)
    || datos.respuesta || datos.content || (typeof datos === 'string' ? datos : '');
  const r = typeof contenido === 'object' ? contenido : extraerJson(String(contenido));

  return {
    resumen: String(r.resumen || '').slice(0, 500),
    categoriaSugerida: String(r.categoria_sugerida || ''),
    prioridad: prioridades.includes(r.prioridad) ? r.prioridad : 'Media',
    motivoPrioridad: String(r.motivo_prioridad || '').slice(0, 300),
    area: String(r.area_atencion || 'Atención al Vecino'),
    recomendaciones: Array.isArray(r.recomendaciones) ? r.recomendaciones.slice(0, 5).map(String) : [],
    palabrasClave: Array.isArray(r.palabras_clave) ? r.palabras_clave.slice(0, 8).map(x => String(x).toLowerCase()) : [],
    fotoCoincide: r.foto_coincide !== false,
    relacionTextoImagen: String(r.relacion_texto_imagen || '').slice(0, 300)
  };
}

// Prioridad final: la de GPT; si GPT fallo, se decide con el sentimiento.
// Si el texto es muy negativo nunca queda en "Baja".
function decidirPrioridad(sentimiento, gpt) {
  let p = gpt ? gpt.prioridad : null;
  if (!p) p = sentimiento && sentimiento.critica ? 'Alta' : 'Media';
  if (sentimiento && sentimiento.critica && p === 'Baja') p = 'Media';
  return p;
}

// Corre los tres servicios. Si uno falla, los demas siguen y se guarda el error.
async function analizarQueja(q, foto) {
  const resultado = { fecha: Date.now(), errores: {} };

  const [sent, img] = await Promise.allSettled([
    configurado('sentimiento') ? analizarSentimiento(q.descripcion) : Promise.reject(new Error('Servicio de sentimiento no configurado')),
    configurado('vision') ? analizarImagen(foto) : Promise.reject(new Error('Servicio de imagen no configurado'))
  ]);
  if (sent.status === 'fulfilled') resultado.sentimiento = sent.value; else resultado.errores.sentimiento = sent.reason.message;
  if (img.status === 'fulfilled') resultado.imagen = img.value; else resultado.errores.imagen = img.reason.message;

  try {
    if (!configurado('gpt')) throw new Error('Servicio GPT no configurado');
    resultado.gpt = await consultarGpt(q, resultado.sentimiento, resultado.imagen);
  } catch (e) {
    resultado.errores.gpt = e.message;
  }

  resultado.prioridad = decidirPrioridad(resultado.sentimiento, resultado.gpt);
  const fallos = Object.keys(resultado.errores).length;
  resultado.estado = fallos === 0 ? 'completo' : fallos === 3 ? 'error' : 'parcial';
  return resultado;
}

module.exports = { analizarQueja, UMBRAL_ETIQUETAS, UMBRAL_NEGATIVO, configurado };
