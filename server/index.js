const express = require('express');
const path = require('path');
const cors = require('cors');

const { router: authRouter } = require('./auth');
const { publico, admin, procesarPendientes } = require('./quejas');

const app = express();
app.use(cors());
app.use(express.json({ limit: '6mb' })); // la foto viene en base64

app.use('/api/auth', authRouter);
app.use('/api', publico);
app.use('/api/admin', admin);

// si el JSON viene mal formado o muy pesado
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'La información enviada es muy pesada' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Los datos enviados no son válidos' });
  next(err);
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// frontend ya compilado
const carpetaCliente = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(carpetaCliente));
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(carpetaCliente, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Servidor corriendo en el puerto ' + PORT);
  procesarPendientes().catch(err => console.error('No se pudieron procesar pendientes:', err.message));
});
