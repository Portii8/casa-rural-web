-- =====================================================================
-- IMPORTANTE: ejecuta este archivo por PARTES, no todo de golpe.
-- Copia el "PASO 1", dale a Run. Cuando funcione, copia el "PASO 2", etc.
-- Así si algo falla, sabes exactamente en qué paso fue.
-- =====================================================================

-- ---------------------------------------------------------------------
-- PASO 1: activar la función que genera IDs únicos
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto;


-- ---------------------------------------------------------------------
-- PASO 2: crear la tabla de reservas
-- ---------------------------------------------------------------------
create table if not exists reservations (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  guest_name text,
  check_in date not null,
  check_out date not null,
  price_per_night numeric,
  source text default 'manual',
  notes text,
  created_at timestamptz default now()
);


-- ---------------------------------------------------------------------
-- PASO 3: activar seguridad a nivel de fila (obligatorio en Supabase)
-- ---------------------------------------------------------------------
alter table reservations enable row level security;


-- ---------------------------------------------------------------------
-- PASO 4: permitir que la app lea y escriba reservas
-- (si ya existe una política con este nombre, la borramos primero
-- para poder ejecutar esto varias veces sin que dé error)
-- ---------------------------------------------------------------------
drop policy if exists "Permitir todo con clave anon" on reservations;

create policy "Permitir todo con clave anon"
  on reservations
  for all
  using (true)
  with check (true);


-- =====================================================================
-- PASO 5 (NO es SQL, es un paso en el panel de Supabase):
-- Para que los cambios se vean en tiempo real entre dispositivos:
--   1. Ve al menú lateral "Database" -> "Replication".
--   2. Busca "supabase_realtime" y actívalo para la tabla "reservations".
-- Si no lo activas, la app funciona igual, solo que hay que recargar
-- la página para ver cambios hechos desde otro dispositivo.
-- =====================================================================
