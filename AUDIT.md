# Auditoria de la suite
Fecha: 2026-09-06. Alcance: The Goy Project y Keep Slopping, React, persistencia, Supabase, PWA, dependencias y experiencia movil.

## Hallazgos corregidos
- Alto: una cache sin propietario podia mezclar datos de cuentas al cambiar de sesion. La cache nueva usa claves por aplicacion y usuario; cerrar sesion desmonta tambien los borradores de la interfaz. Los datos sin propietario no se importan automaticamente a una cuenta autenticada.
- Alto: el guardado de listas completas podia sobrescribir registros creados desde otro dispositivo. La RPC nueva aplica altas, cambios y bajas por identificador, en una transaccion con bloqueo de fila, validacion del propietario y RLS. Las comidas se identifican por fecha y comida.
- Alto: una clave secreta expuesta anteriormente seguia activa. Fue revocada en Supabase; las claves publicas y las cuentas se conservaron. Ninguna app ni Edge Function dependia de esa clave.
- Medio: consultas dentro del callback de autenticacion podian bloquear el cliente. El callback ahora libera el bloqueo antes de hidratar; los eventos repetidos de la misma cuenta no vuelven a descargar todo el historial.
- Medio: una respuesta tardia podia reemplazar los datos de otra cuenta. Se invalidan solicitudes anteriores y el servidor verifica el usuario esperado en cada escritura.
- Medio: cambios sin conexion podian perderse al volver a abrir. La cache guarda el estado y su ultima base remota; se reaplican los cambios pendientes al reconectar. Las escrituras remotas estan serializadas y agrupadas.
- Medio: activar el service worker eliminaba caches de otras aplicaciones del mismo dominio. Cada app limpia solamente su prefijo y atiende solamente su ruta.
- Medio: una migracion de Keep Slopping reemplazaba planes personalizados antiguos y sesiones. Ahora actualiza el formato sin sustituir el plan.
- Medio: el indice de rotacion de rutinas fallaba al recorrer mas de un ciclo. Se corrigio el modulo negativo y se añadieron pruebas.
- Medio: editar un entrenamiento cambiaba su hora de inicio y redondeaba su duracion. Ahora se conservan cuando no se editan esos valores.
- Dependencias: npm audit inicial detecto 3 vulnerabilidades altas en Training y 1 en Keep Slopping. Se actualizaron las versiones compatibles del lockfile; la comprobacion final devuelve 0 vulnerabilidades conocidas en ambas.

## Experiencia y rendimiento
- Tema del dispositivo por defecto, tanto en el arranque como ante cambios en tiempo real. Menu Dispositivo / Claro / Oscuro; eleccion y acento compartidos entre pestañas del mismo origen.
- Barra de estado y color del navegador coherentes con el tema. Logos nuevos, monocromaticos, centrados y coherentes entre aplicaciones, con variantes PWA y apple-touch-icon.
- Tipografia Manrope variable, solamente el subconjunto latino (24.83 kB), eliminando las descargas de otros alfabetos.
- Componentes de apariencia, frases y sincronizacion extraidos de App. La rotacion de frases ya no vuelve a renderizar toda la aplicacion y se pausa con la pestaña oculta.
- Controles tactiles, contraste mejorado, transiciones sutiles y respeto a prefers-reduced-motion, incluidos los retrasos de animacion.
- Keep Slopping indexa las sesiones del dia en una sola pasada, en vez de recorrer el historial por cada comida. El dia se actualiza al llegar medianoche o volver a la app.
- Lecturas limitadas a la seccion de cada app. No se hacen escrituras durante una lectura/migracion remota.
- Ejemplo sintetico de 1,000 entrenamientos: añadir un registro envia 1,711 bytes de cambios en lugar de 1,652,555 bytes de lista completa (99.90% menos). No es una medicion de latencia real ni representa todos los casos.
- CSP de produccion: scripts y recursos propios, conexiones solamente al proyecto de Supabase, sin object/embed ni formularios a terceros.
- Se retiraron efectos, imports, tipos y escritura local heredada sin consumidores. Se mantiene la lectura de caches antiguas para dispositivos sin Supabase configurado.

## Validacion
- Training: 27 pruebas unitarias/integracion; Keep Slopping: 35.
- Playwright: 10 escenarios por app, en iPhone/WebKit, Android/Chromium, iPad/WebKit, escritorio y telefono de 320 px. Creacion, guardado, datos anteriores, checklists, persistencia, no duplicacion de calorias, tema automatico, override manual y logos.
- Comprobaciones axe sobre ambas pantallas iniciales en claro/oscuro, sin incidencias serias/criticas en el alcance probado.
- Script de produccion scripts/check-suite.mjs en Training: CSP, logos, configuracion publica, cambio compartido de tema/acento, caches separadas, recarga sin conexion en Chromium y recarga con servidor inaccesible en WebKit.
- Pruebas SQL con dos usuarios sinteticos y roles authenticated/anon: aislamiento de cuentas, actualizaciones parciales, comidas no duplicadas, eliminacion acotada y rechazo de usuario incorrecto. Las pruebas se ejecutan en una transaccion que termina en rollback.
- La migracion publicada cambia funciones/permisos/politicas, no los registros reales. La prueba posterior a la instalacion mantuvo las tres cuentas y la misma huella de datos antes/despues.
- Lint, TypeScript, builds y auditoria de dependencias en ambos repositorios.
- Los dos workflows ejecutan lint, tests unitarios/integracion y pruebas de navegador antes de publicar en GitHub Pages.

## Limites
- No se garantiza ausencia absoluta de errores. Los navegadores de pruebas no sustituyen un iPhone/Android fisico instalado como PWA.
- El modo offline emulado de WebKit fallo al navegar con un error interno. La comprobacion equivalente corta las conexiones del servidor; el modo avion real en iOS requiere comprobacion en dispositivo.
- Se conserva la restriccion de zoom solicitada anteriormente. La regla axe meta-viewport esta excluida expresamente; no se declara conformidad WCAG completa.
- Cambios simultaneos sobre el mismo registro usan la ultima escritura aceptada. Los cambios en registros distintos y secciones distintas se preservan. Clientes antiguos abiertos conservan su logica anterior hasta actualizarse.
- La carga inicial aun lee el historial de esa app desde una fila JSONB por usuario. Para historiales de tamaño mucho mayor convendria una migracion independiente a tablas normalizadas y consultas paginadas.
- No se enviaron correos de recuperacion reales ni se modificaron contraseñas de usuarios. Las cuotas de correo y la entrega dependen de Supabase/SMTP.
- Las dos apps comparten origen en GitHub Pages: la separacion por usuario evita mezclas accidentales, pero no crea una barrera de seguridad entre codigo de ambas apps. No deben añadirse scripts de terceros no confiables.

## Logos
Generados con la herramienta integrada image_gen, no con CLI. Briefs de generacion:
- The Goy Project: logo minimalista monocromatico; una G geometrica, redondeada, con barra horizontal integrada, centrada en un lienzo cuadrado blanco; trazos limpios, sin texto, sombras, degradados ni mockups.
- Keep Slopping: logo compañero de la G de referencia; cuenco y cuchara simplificados, mismo grosor de trazo, terminaciones redondeadas, escala y espacio en blanco; negro sobre blanco, centrado, sin texto, sombras ni degradados.

Archivos finales en cada repositorio:
- public/app-icon-512.png
- public/app-icon-192.png
- public/apple-touch-icon.png
- public/favicon.png

## Referencias
- [Bloqueo del callback de autenticacion de Supabase](https://supabase.com/docs/guides/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0).
- [RLS y optimizacion de auth.uid](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [Claves publicas y secretas de Supabase](https://supabase.com/docs/guides/getting-started/api-keys).
