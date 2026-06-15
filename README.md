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

La app puede sincronizar datos con Supabase usando login por email. Si Supabase no esta configurado, usa IndexedDB local como respaldo.

## Supabase

1. Crea un proyecto en Supabase.
2. Abre SQL Editor y ejecuta `supabase/schema.sql`.
3. En Authentication -> URL Configuration usa:

```text
Site URL:
https://alexrodarana.github.io/the-goy-project/

Redirect URLs:
https://alexrodarana.github.io/the-goy-project/**
http://localhost:5173/**
```

La URL del proyecto de Supabase debe tener este formato:

```text
https://<project-ref>.supabase.co
```

4. En GitHub -> repo -> Settings -> Secrets and variables -> Actions -> Secrets agrega:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

5. Corre de nuevo el workflow de GitHub Pages.

Para desarrollo local, copia `.env.example` a `.env.local` y llena esos valores.

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
