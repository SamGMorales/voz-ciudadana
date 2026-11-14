# Voz Ciudadana

Sistema de quejas ciudadanas para la municipalidad - Examen final Desarrollo Web

Marjorie Samantha Giron Morales - 1890-22-19957

## Link del sitio

https://voz-ciudadana-1890-22-19957.onrender.com

(está en Render gratis)

## Usuario del panel municipal

- correo: admin@vozciudadana.com
- contraseña: Muni2026

## Cómo funciona

El ciudadano llena el formulario con su queja y una foto, el frontend lo manda al backend, el backend lo guarda en Firebase y le devuelve un número de folio. Con ese folio puede consultar cómo va su reporte.

El personal municipal entra al panel, ve todas las quejas con su foto y descripción, las puede filtrar y les cambia el estado o les responde.

## Servicios de IA (serie 3)

Después de guardar la queja el backend la manda a los 3 servicios de Azure del curso:

- Sentimiento: si el texto sale negativo con 80% o más de confianza, la queja se marca como crítica y sale primero en el panel.
- Imagen: solo se usan las etiquetas que tienen 70% o más de confianza, las demás se ignoran (en el detalle salen tachadas).
- GPT: se le manda la descripción, el sentimiento y lo que se ve en la foto, y devuelve un resumen, la prioridad, el área que debe atenderla, recomendaciones y si la foto tiene que ver con la queja.

Las llaves de Azure y Firebase están como variables de entorno en Render, no están en el código.

## Tecnologías

- React (Vite)
- Node.js con Express
- Firebase Realtime Database
- Azure (Text Analytics, Computer Vision y OpenAI)
- Render

## Endpoints

- GET /api/catalogos
- POST /api/quejas
- GET /api/quejas/folio/:folio
- POST /api/auth/login
- GET /api/admin/quejas
- GET /api/admin/quejas/:id
- PATCH /api/admin/quejas/:id
- POST /api/admin/quejas/:id/analizar
- GET /api/admin/estadisticas

## Correr en local

Hay que poner las variables FIREBASE_SERVICE_ACCOUNT, FIREBASE_DB_URL, JWT_SECRET, SENTIMIENTO_KEY, VISION_KEY y GPT_KEY.

```
npm install
npm run build
npm start
```
