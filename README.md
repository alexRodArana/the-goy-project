# The Goy Project

PWA para crear rutinas, registrar series y consultar entrenamientos en el calendario.

React 19, TypeScript, Vite y Supabase Auth/Postgres. Ambas apps comparten cuentas, apariencia y una fila de datos por usuario, pero leen y actualizan solo su propia seccion.

## Desarrollo

Node.js 24 LTS. Configura en `.env.local` las variables de `.env.example`: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Usa una clave publishable/anon, nunca una clave secret/service_role. Sin configuracion se puede trabajar localmente; esos datos no se importan automaticamente a una cuenta.

```bash
npm ci
npm run dev
npm run lint
npm test
npx playwright install chromium webkit
npm run test:e2e
npm run build
```

## Persistencia

IndexedDB mantiene cache por app y usuario y cambios pendientes. La sincronizacion envia diferencias por registro, verifica el propietario y no sustituye el estado de la otra app. Cerrar sesion limpia los datos visibles y los borradores de esa cuenta.

Para una instalacion nueva de Supabase, ejecutar primero `supabase/schema.sql` y despues `supabase/migrations/202609050001_incremental_sync.sql` del repositorio The Goy Project. No basta con instalar solo el esquema antiguo. Ambos frontends requieren esa migracion. Las pruebas SQL estan en `supabase/tests/incremental_sync.sql` del mismo repositorio.

## Publicacion

[The Goy Project](https://alexrodarana.github.io/the-goy-project/). La cuenta de GitHub no puede iniciar runners hospedados, por lo que la publicacion usa la rama generada `gh-pages` y no depende de Actions. Pages debe estar configurado con `gh-pages` y `/(root)`.

`npm run deploy` ejecuta lint, pruebas unitarias, la matriz movil/escritorio, el build y una comprobacion del service worker en Chromium/WebKit antes de actualizar `gh-pages`. La configuracion publica de Supabase se toma de `.env.local`; nunca uses una clave secret o `service_role`.

El tema sigue al dispositivo por defecto. El menu de apariencia permite elegir Dispositivo, Claro u Oscuro; el acento es independiente. Los iconos de la suite se encuentran en `public/`.

[Informe de auditoria, validaciones y limites](AUDIT.md).
