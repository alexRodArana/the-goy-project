# The Goy Project

Plataforma web para registrar cambio fisico: peso, fotos diarias, rutinas y entrenamientos con series, repeticiones, cargas, temporizador y graficas.

## Stack

- React 19 + TypeScript
- Vite para desarrollo y build estatico
- IndexedDB para guardar datos y fotos en el navegador
- CSS propio, sin framework visual pesado
- PWA basica con manifest y service worker

## Secciones

- Training: selector de rutina, creacion enfocada de rutina e inicio de entrenamiento.
- Historial: entrenamientos por fecha, rutina y duracion, con detalle por ejercicio.
- Timeline: linea horizontal de fotos verticales y peso, con captura nueva al final.
- Dashboard: metricas mensuales, graficas de peso y grafica multiejercicio con toggles.

## Comandos

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Datos

La app guarda todo en IndexedDB del navegador. Esto mantiene el MVP gratis y rapido, sin base de datos ni servidor. Usa los botones de importar/exportar backup para mover tus registros entre dispositivos.

Para sincronizacion entre dispositivos en una siguiente fase, el upgrade natural es Supabase Free para auth, Postgres y storage.

## Deploy gratis

### Vercel

1. Sube el repo a GitHub.
2. Importa el proyecto en Vercel.
3. Vercel detecta Vite y usa `npm run build` con salida `dist`.

El archivo `vercel.json` ya esta incluido.

### Netlify

1. Sube el repo a GitHub.
2. Crea un sitio nuevo desde Git en Netlify.
3. Usa build command `npm run build` y publish directory `dist`.

El archivo `netlify.toml` ya esta incluido.

### GitHub Pages

1. Sube el repo a GitHub.
2. Activa Pages desde GitHub Actions en Settings -> Pages.
3. Haz push a `main`.

El workflow `.github/workflows/deploy-pages.yml` construye y publica `dist`.
