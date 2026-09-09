import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Faltan las variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Revisa tu archivo .env"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ---- Conversión entre snake_case (base de datos) y camelCase (app) ----
export function fromDb(row) {
  return {
    id: row.id,
    roomId: row.room_id,
    guestName: row.guest_name,
    checkIn: row.check_in,
    checkOut: row.check_out,
    pricePerNight: row.price_per_night,
    source: row.source,
    notes: row.notes,
  };
}

export function toDb(r) {
  return {
    room_id: r.roomId,
    guest_name: r.guestName,
    check_in: r.checkIn,
    check_out: r.checkOut,
    price_per_night: r.pricePerNight === "" ? null : r.pricePerNight,
    source: r.source,
    notes: r.notes,
  };
}
