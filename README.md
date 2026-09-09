# Casa Rural · Gestión de reservas

App web con calendario, reservas por habitación y cuentas mensuales, con base de
datos real en Supabase. Sigue estos pasos en orden, no hace falta saber programar.

## 1. Crear la base de datos (Supabase) — gratis

1. Ve a https://supabase.com y crea una cuenta gratuita.
2. Crea un proyecto nuevo (elige una contraseña de base de datos, guárdala en algún sitio).
3. Cuando el proyecto esté listo, ve al menú lateral **SQL Editor**.
4. Abre el archivo `supabase-schema.sql` de esta carpeta. **Cópialo y pégalo en
   el editor por partes** (el propio archivo indica "PASO 1", "PASO 2"...),
   dando a **Run** después de cada uno. Si copias todo el archivo de golpe
   normalmente también funciona, pero si te da error, hazlo paso a paso para
   saber exactamente dónde falla.
5. El "PASO 5" del archivo no es código SQL: es una indicación para activar
   el tiempo real desde el panel (**Database → Replication**, buscas
   `supabase_realtime` y activas la tabla `reservations`). Es opcional — sin
   esto la app funciona igual, solo que hay que recargar para ver cambios
   hechos desde otro dispositivo.
6. Ve a **Project Settings → API**. Ahí verás dos datos que necesitas:
   - **Project URL**
   - **anon public key**

## 2. Configurar el proyecto

1. Dentro de esta carpeta, copia el archivo `.env.example` y renómbralo a `.env`.
2. Abre `.env` y sustituye los valores por los que copiaste de Supabase:
   ```
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-clave-anon-publica
   ```

## 3. Probarlo en tu ordenador (opcional pero recomendable)

Necesitas tener [Node.js](https://nodejs.org) instalado (versión 18 o superior).

```bash
npm install
npm run dev
```

Se abrirá en `http://localhost:5173`. Prueba a crear una reserva y comprobar que
aparece también en Supabase (en el menú **Table Editor → reservations**).

## 4. Publicarlo en internet (Vercel) — gratis

### Opción más sencilla: con la terminal, sin GitHub

```bash
npm install -g vercel
vercel
```

- La primera vez te pedirá iniciar sesión (te abre el navegador, creas cuenta gratis con Google o email).
- Te hará varias preguntas: acepta las opciones por defecto.
- Cuando pregunte por las variables de entorno, o si no te las pide, añádelas después
  desde el panel de Vercel: **Project → Settings → Environment Variables**, y añade
  las mismas dos variables (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`).
- Vuelve a ejecutar `vercel --prod` para publicar la versión definitiva.
- Te dará un enlace tipo `https://casa-rural-gestion.vercel.app` — ese es el que
  compartes con tu madre.

### Alternativa: con GitHub (recomendable si vas a seguir tocando el código)

1. Sube esta carpeta a un repositorio nuevo en GitHub.
2. Entra en https://vercel.com, "Add New Project", conecta tu cuenta de GitHub y
   selecciona el repositorio.
3. En "Environment Variables" añade `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. Pulsa "Deploy". Cada vez que subas cambios a GitHub, Vercel actualiza la web sola.

## 5. Usarlo en el móvil

1. Abre el enlace de Vercel en el navegador del móvil (Safari en iPhone, Chrome en Android).
2. Usa la opción "Añadir a pantalla de inicio" del navegador.
3. Le queda como un icono más, se abre a pantalla completa.

## 6. (Opcional) Dominio propio

Si quieres algo tipo `reservas-tucasarural.com` en vez de `.vercel.app`:
1. Compra el dominio en Namecheap, IONOS o similar (~10-12€/año).
2. En Vercel, ve a **Project → Settings → Domains** y añade tu dominio, siguiendo
   las instrucciones para apuntar el DNS (Vercel te lo indica paso a paso).

## Notas importantes

- **Seguridad**: esta app no tiene login. Cualquiera con el enlace puede ver y
  editar las reservas. Compártelo solo con quien deba usarlo.
- **Cambios en tiempo real**: si tu madre y tú tenéis la web abierta a la vez en
  dos dispositivos, los cambios se ven al momento gracias a Supabase Realtime.
- **Copias de seguridad**: Supabase hace copias automáticas, pero en el plan
  gratuito solo se guardan unos días. Si quieres histórico más largo, se puede
  exportar la tabla manualmente de vez en cuando desde el Table Editor.
