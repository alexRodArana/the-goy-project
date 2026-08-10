# The Goy Project

PWA mobile-first para crear rutinas, registrar series, repeticiones, cargas y cardio, y consultar el historial en un calendario.

## Stack

- React 19, TypeScript y Vite
- Supabase Auth + Postgres para sincronizacion por usuario
- IndexedDB como cache local y respaldo sin conexion
- CSS propio, PWA y service worker

The Goy Project comparte cuenta y fila de estado con Keep Slopping. Cada app lee y actualiza solo su propia seccion mediante funciones atomicas de Postgres.

## Desarrollo

```bash
npm install
npm run dev
npm run lint
npm test
npm run build
```

Variables requeridas en `.env.local`:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Ejecuta `supabase/schema.sql` en el SQL Editor del proyecto para crear la tabla, las politicas RLS y las funciones de lectura y escritura parcial.

## Deploy

La version publica se sirve desde la rama `gh-pages`:

https://alexrodarana.github.io/the-goy-project/
