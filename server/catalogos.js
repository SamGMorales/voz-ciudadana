// Catalogos que usa el formulario y el panel
const categorias = [
  'Alumbrado público',
  'Baches y calles',
  'Basura y limpieza',
  'Agua potable',
  'Drenajes',
  'Seguridad',
  'Ruido',
  'Parques y áreas verdes',
  'Tránsito',
  'Otro'
];

const zonas = Array.from({ length: 21 }, (_, i) => 'Zona ' + (i + 1));

const estados = ['Pendiente', 'En revisión', 'En proceso', 'Resuelta', 'Rechazada'];

const prioridades = ['Baja', 'Media', 'Alta'];

module.exports = { categorias, zonas, estados, prioridades };
