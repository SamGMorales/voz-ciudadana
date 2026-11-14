const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'clave-local-desarrollo';

// Usuario del personal municipal. Se puede cambiar con variables de entorno en Render.
const ADMIN_CORREO = (process.env.ADMIN_CORREO || 'admin@vozciudadana.com').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Muni2026';

router.post('/login', (req, res) => {
  const { correo, password } = req.body || {};
  if (!correo || !password) {
    return res.status(400).json({ error: 'Ingresa correo y contraseña' });
  }
  if (String(correo).trim().toLowerCase() !== ADMIN_CORREO || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  }
  const token = jwt.sign({ correo: ADMIN_CORREO, rol: 'admin' }, SECRET, { expiresIn: '8h' });
  res.json({ token, usuario: { correo: ADMIN_CORREO, nombre: 'Personal municipal' } });
});

// protege las rutas del panel
function soloAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  try {
    const datos = jwt.verify(token, SECRET);
    if (datos.rol !== 'admin') throw new Error('sin permiso');
    req.usuario = datos;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Debes iniciar sesión como personal municipal' });
  }
}

module.exports = { router, soloAdmin };
