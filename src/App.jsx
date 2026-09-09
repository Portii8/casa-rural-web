import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase, fromDb, toDb } from "./supabaseClient";

// ---------- Datos base ----------
const ROOMS = [
  { id: "r1", name: "Habitación 1", floor: "Planta 1", accessible: false, color: "#2F5233" },
  { id: "r2", name: "Habitación 2", floor: "Planta 1", accessible: false, color: "#6E5B3E" },
  { id: "r3", name: "Habitación 3", floor: "Planta 1", accessible: false, color: "#9C6B2E" },
  { id: "r4", name: "Habitación 4", floor: "Planta 1", accessible: false, color: "#3E6E63" },
  { id: "r5", name: "Habitación 5", floor: "Planta 1", accessible: false, color: "#B2843E" },
  { id: "r6", name: "Habitación 6", floor: "Planta 1", accessible: false, color: "#5B4A6E" },
  { id: "r7", name: "Habitación 7", floor: "Planta baja · Accesible", accessible: true, color: "#2E6E80" },
];

const SOURCES = [
  { id: "manual", label: "Directa / teléfono" },
  { id: "booking", label: "Booking.com" },
  { id: "otras", label: "Otra plataforma" },
];

const MONTHS_ES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];
const DOW_ES = ["Lu","Ma","Mi","Ju","Vi","Sa","Do"];

// ---------- Utilidades de fecha ----------
function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parseISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(d, n) {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
}
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isWeekend(d) {
  const day = d.getDay();
  return day === 0 || day === 6;
}
function inRange(day, checkIn, checkOut) {
  return day >= checkIn && day < checkOut;
}
function daysBetween(a, b) {
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}
function euros(n) {
  const num = Number(n) || 0;
  return num.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " €";
}
function nightsOf(r) {
  return daysBetween(parseISO(r.checkIn), parseISO(r.checkOut));
}
function totalOf(r) {
  return (Number(r.pricePerNight) || 0) * nightsOf(r);
}

// ---------- Componente principal ----------
export default function App() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [topView, setTopView] = useState("calendario");
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [accountsMonth, setAccountsMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [selectedRoomId, setSelectedRoomId] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [listTab, setListTab] = useState("proximas");

  // ---- Carga inicial + tiempo real ----
  const loadReservations = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("reservations")
      .select("*")
      .order("check_in", { ascending: true });
    if (err) {
      setError("No se pudieron cargar las reservas: " + err.message);
      setLoading(false);
      return;
    }
    setReservations(data.map(fromDb));
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadReservations();

    const channel = supabase
      .channel("reservations-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => {
        loadReservations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadReservations]);

  // ---- CRUD ----
  async function upsertReservation(data) {
    if (editingId) {
      const { error: err } = await supabase.from("reservations").update(toDb(data)).eq("id", editingId);
      if (err) {
        setError("No se pudo guardar: " + err.message);
        return;
      }
    } else {
      const { error: err } = await supabase.from("reservations").insert([toDb(data)]);
      if (err) {
        setError("No se pudo crear: " + err.message);
        return;
      }
    }
    setShowForm(false);
    setEditingId(null);
    loadReservations();
  }

  async function deleteReservation(id) {
    const { error: err } = await supabase.from("reservations").delete().eq("id", id);
    if (err) {
      setError("No se pudo eliminar: " + err.message);
      return;
    }
    setShowForm(false);
    setEditingId(null);
    loadReservations();
  }

  function startEdit(id) {
    setEditingId(id);
    setShowForm(true);
  }

  const calendarCells = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startWeekday = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewDate]);

  const visibleReservations = useMemo(() => {
    if (selectedRoomId === "all") return reservations;
    return reservations.filter((r) => r.roomId === selectedRoomId);
  }, [reservations, selectedRoomId]);

  function reservationsForDay(day) {
    if (!day) return [];
    return visibleReservations.filter((r) => inRange(day, parseISO(r.checkIn), parseISO(r.checkOut)));
  }

  const today = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);

  const sortedReservations = useMemo(() => {
    return [...reservations].sort((a, b) => parseISO(a.checkIn) - parseISO(b.checkIn));
  }, [reservations]);

  const upcoming = sortedReservations.filter((r) => parseISO(r.checkOut) >= today);
  const past = [...sortedReservations].filter((r) => parseISO(r.checkOut) < today).reverse();

  function roomById(id) {
    return ROOMS.find((r) => r.id === id);
  }

  const occupiedTonight = reservations.filter((r) =>
    inRange(today, parseISO(r.checkIn), parseISO(r.checkOut))
  ).length;

  function reservationsInMonth(year, month) {
    return reservations.filter((r) => {
      const ci = parseISO(r.checkIn);
      return ci.getFullYear() === year && ci.getMonth() === month;
    });
  }

  const accountsYear = accountsMonth.getFullYear();
  const accountsMonthIdx = accountsMonth.getMonth();
  const monthReservations = useMemo(
    () => reservationsInMonth(accountsYear, accountsMonthIdx).sort((a, b) => parseISO(a.checkIn) - parseISO(b.checkIn)),
    [reservations, accountsYear, accountsMonthIdx]
  );
  const monthTotal = monthReservations.reduce((sum, r) => sum + totalOf(r), 0);
  const monthNights = monthReservations.reduce((sum, r) => sum + nightsOf(r), 0);
  const monthAvgNight = monthNights > 0 ? monthTotal / monthNights : 0;

  const last6Months = useMemo(() => {
    const arr = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(accountsYear, accountsMonthIdx - i, 1);
      const resosInM = reservationsInMonth(d.getFullYear(), d.getMonth());
      const total = resosInM.reduce((sum, r) => sum + totalOf(r), 0);
      arr.push({ date: d, total, count: resosInM.length });
    }
    return arr;
  }, [reservations, accountsYear, accountsMonthIdx]);
  const maxMonthTotal = Math.max(1, ...last6Months.map((m) => m.total));

  if (loading) {
    return (
      <div style={{ ...styles.app, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: COLORS.inkSoft, fontFamily: "'Work Sans', sans-serif" }}>Cargando reservas…</div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>Casa rural</div>
          <h1 style={styles.title}>Gestión de reservas</h1>
        </div>
        <button
          style={styles.primaryBtn}
          onClick={() => {
            setEditingId(null);
            setShowForm(true);
          }}
        >
          + Nueva reserva
        </button>
      </header>

      <div style={styles.segmentRow}>
        <button
          style={{ ...styles.segmentBtn, ...(topView === "calendario" ? styles.segmentBtnActive : {}) }}
          onClick={() => setTopView("calendario")}
        >
          Calendario
        </button>
        <button
          style={{ ...styles.segmentBtn, ...(topView === "cuentas" ? styles.segmentBtnActive : {}) }}
          onClick={() => setTopView("cuentas")}
        >
          Cuentas
        </button>
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}

      {topView === "calendario" && (
        <>
          <div style={styles.statsRow}>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{occupiedTonight} / {ROOMS.length}</div>
              <div style={styles.statLabel}>Habitaciones ocupadas hoy</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{upcoming.length}</div>
              <div style={styles.statLabel}>Reservas próximas</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{ROOMS.length}</div>
              <div style={styles.statLabel}>Habitaciones totales</div>
            </div>
          </div>

          <div style={styles.body}>
            <aside style={styles.sidebar}>
              <h2 style={styles.sidebarTitle}>Habitaciones</h2>
              <button
                onClick={() => setSelectedRoomId("all")}
                style={{ ...styles.roomItem, ...(selectedRoomId === "all" ? styles.roomItemActive : {}) }}
              >
                <span style={{ ...styles.dot, background: "#A79C86" }} />
                <span style={styles.roomItemName}>Todas</span>
              </button>
              {ROOMS.map((room) => (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoomId(room.id)}
                  style={{ ...styles.roomItem, ...(selectedRoomId === room.id ? styles.roomItemActive : {}) }}
                >
                  <span style={{ ...styles.dot, background: room.color }} />
                  <span style={styles.roomItemName}>
                    {room.name}
                    <span style={styles.roomFloor}>{room.floor}</span>
                  </span>
                </button>
              ))}
            </aside>

            <main style={styles.main}>
              <section style={styles.card}>
                <div style={styles.calHeader}>
                  <button
                    style={styles.navBtn}
                    onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
                  >
                    ‹
                  </button>
                  <div style={styles.calMonthLabel}>
                    {MONTHS_ES[viewDate.getMonth()]} {viewDate.getFullYear()}
                  </div>
                  <button
                    style={styles.navBtn}
                    onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
                  >
                    ›
                  </button>
                </div>

                <div style={styles.dowRow}>
                  {DOW_ES.map((d) => (
                    <div key={d} style={styles.dowCell}>{d}</div>
                  ))}
                </div>

                <div style={styles.grid}>
                  {calendarCells.map((day, i) => {
                    const dayResos = reservationsForDay(day);
                    const isToday = day && isSameDay(day, today);
                    const weekend = day && isWeekend(day);
                    return (
                      <div
                        key={i}
                        style={{
                          ...styles.dayCell,
                          ...(day ? {} : styles.dayCellEmpty),
                          ...(weekend && day ? styles.dayCellWeekend : {}),
                          ...(isToday ? styles.dayCellToday : {}),
                        }}
                      >
                        {day && (
                          <div style={{ ...styles.dayNumber, ...(isToday ? styles.dayNumberToday : {}) }}>
                            {day.getDate()}
                          </div>
                        )}
                        <div style={styles.dayBars}>
                          {dayResos.slice(0, 3).map((r) => {
                            const room = roomById(r.roomId);
                            return (
                              <div
                                key={r.id}
                                title={`${room?.name} · ${r.guestName}`}
                                style={{ ...styles.dayBar, background: room?.color || "#999" }}
                                onClick={() => startEdit(r.id)}
                              >
                                {room?.name?.replace("Habitación ", "H")} · {r.guestName || "—"}
                              </div>
                            );
                          })}
                          {dayResos.length > 3 && (
                            <div style={styles.moreLabel}>+{dayResos.length - 3} más</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section style={styles.card}>
                <div style={styles.tabRow}>
                  <button
                    style={{ ...styles.tabBtn, ...(listTab === "proximas" ? styles.tabBtnActive : {}) }}
                    onClick={() => setListTab("proximas")}
                  >
                    Próximas ({upcoming.length})
                  </button>
                  <button
                    style={{ ...styles.tabBtn, ...(listTab === "pasadas" ? styles.tabBtnActive : {}) }}
                    onClick={() => setListTab("pasadas")}
                  >
                    Pasadas ({past.length})
                  </button>
                </div>

                <div style={styles.list}>
                  {(listTab === "proximas" ? upcoming : past).length === 0 && (
                    <div style={styles.emptyState}>
                      {listTab === "proximas"
                        ? "No hay reservas próximas. Añade una con el botón de arriba."
                        : "Todavía no hay reservas pasadas."}
                    </div>
                  )}
                  {(listTab === "proximas" ? upcoming : past).map((r) => {
                    const room = roomById(r.roomId);
                    const nights = nightsOf(r);
                    const source = SOURCES.find((s) => s.id === r.source);
                    return (
                      <div key={r.id} style={styles.resoRow}>
                        <span style={{ ...styles.dot, background: room?.color || "#999", marginTop: 4 }} />
                        <div style={styles.resoInfo}>
                          <div style={styles.resoTop}>
                            <strong>{r.guestName || "Sin nombre"}</strong>
                            <span style={styles.resoRoom}>{room?.name}</span>
                          </div>
                          <div style={styles.resoDates}>
                            {r.checkIn} → {r.checkOut} · {nights} {nights === 1 ? "noche" : "noches"}
                            {r.pricePerNight ? ` · ${euros(r.pricePerNight)}/noche · ${euros(totalOf(r))} total` : ""}
                            {source ? ` · ${source.label}` : ""}
                          </div>
                          {r.notes && <div style={styles.resoNotes}>{r.notes}</div>}
                        </div>
                        <div style={styles.resoActions}>
                          <button style={styles.linkBtn} onClick={() => startEdit(r.id)}>Editar</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </main>
          </div>
        </>
      )}

      {topView === "cuentas" && (
        <div style={styles.accountsWrap}>
          <section style={styles.card}>
            <div style={styles.calHeader}>
              <button
                style={styles.navBtn}
                onClick={() => setAccountsMonth(new Date(accountsMonth.getFullYear(), accountsMonth.getMonth() - 1, 1))}
              >
                ‹
              </button>
              <div style={styles.calMonthLabel}>
                {MONTHS_ES[accountsMonth.getMonth()]} {accountsMonth.getFullYear()}
              </div>
              <button
                style={styles.navBtn}
                onClick={() => setAccountsMonth(new Date(accountsMonth.getFullYear(), accountsMonth.getMonth() + 1, 1))}
              >
                ›
              </button>
            </div>

            <div style={styles.statsRow}>
              <div style={styles.statCard}>
                <div style={styles.statNumber}>{euros(monthTotal)}</div>
                <div style={styles.statLabel}>Ingresos del mes</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statNumber}>{monthReservations.length}</div>
                <div style={styles.statLabel}>Reservas iniciadas este mes</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statNumber}>{monthNights}</div>
                <div style={styles.statLabel}>Noches vendidas</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statNumber}>{monthNights > 0 ? euros(monthAvgNight) : "—"}</div>
                <div style={styles.statLabel}>Precio medio / noche</div>
              </div>
            </div>

            <div style={styles.accountsNote}>
              Cada reserva se contabiliza en el mes de su fecha de entrada. Si una estancia cruza de un mes a otro, el ingreso completo se asigna al mes de entrada.
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sidebarTitle}>Últimos 6 meses</h2>
            <div style={styles.barsChart}>
              {last6Months.map((m, i) => (
                <div key={i} style={styles.barsCol}>
                  <div style={styles.barsValue}>{m.total > 0 ? euros(m.total) : "—"}</div>
                  <div style={styles.barsTrack}>
                    <div
                      style={{
                        ...styles.barsFill,
                        height: `${Math.max(4, (m.total / maxMonthTotal) * 100)}%`,
                        background:
                          m.date.getFullYear() === accountsYear && m.date.getMonth() === accountsMonthIdx
                            ? COLORS.accent
                            : COLORS.accentSoft2,
                      }}
                    />
                  </div>
                  <div style={styles.barsLabel}>{MONTHS_ES[m.date.getMonth()].slice(0, 3)}</div>
                </div>
              ))}
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sidebarTitle}>Reservas de {MONTHS_ES[accountsMonthIdx].toLowerCase()}</h2>
            <div style={styles.list}>
              {monthReservations.length === 0 && (
                <div style={styles.emptyState}>No hay reservas con entrada en este mes.</div>
              )}
              {monthReservations.map((r) => {
                const room = roomById(r.roomId);
                const nights = nightsOf(r);
                return (
                  <div key={r.id} style={styles.resoRow}>
                    <span style={{ ...styles.dot, background: room?.color || "#999", marginTop: 4 }} />
                    <div style={styles.resoInfo}>
                      <div style={styles.resoTop}>
                        <strong>{r.guestName || "Sin nombre"}</strong>
                        <span style={styles.resoRoom}>{room?.name}</span>
                      </div>
                      <div style={styles.resoDates}>
                        {r.checkIn} → {r.checkOut} · {nights} {nights === 1 ? "noche" : "noches"}
                      </div>
                    </div>
                    <div style={styles.resoTotal}>{euros(totalOf(r))}</div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {showForm && (
        <ReservationForm
          rooms={ROOMS}
          sources={SOURCES}
          existing={editingId ? reservations.find((r) => r.id === editingId) : null}
          onCancel={() => {
            setShowForm(false);
            setEditingId(null);
          }}
          onSave={upsertReservation}
          onDelete={editingId ? () => deleteReservation(editingId) : null}
        />
      )}
    </div>
  );
}

// ---------- Formulario modal ----------
function ReservationForm({ rooms, sources, existing, onCancel, onSave, onDelete }) {
  const [roomId, setRoomId] = useState(existing?.roomId || rooms[0].id);
  const [guestName, setGuestName] = useState(existing?.guestName || "");
  const [checkIn, setCheckIn] = useState(existing?.checkIn || toISO(new Date()));
  const [checkOut, setCheckOut] = useState(existing?.checkOut || toISO(addDays(new Date(), 1)));
  const [source, setSource] = useState(existing?.source || "manual");
  const [pricePerNight, setPricePerNight] = useState(existing?.pricePerNight ?? "");
  const [notes, setNotes] = useState(existing?.notes || "");
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    const n = daysBetween(parseISO(checkIn), parseISO(checkOut));
    return n > 0 ? n : 0;
  }, [checkIn, checkOut]);

  const total = (Number(pricePerNight) || 0) * nights;

  async function handleSave() {
    if (!checkIn || !checkOut) {
      setFormError("Indica fecha de entrada y salida.");
      return;
    }
    if (parseISO(checkOut) <= parseISO(checkIn)) {
      setFormError("La fecha de salida debe ser posterior a la de entrada.");
      return;
    }
    setFormError(null);
    setSaving(true);
    await onSave({ roomId, guestName, checkIn, checkOut, source, pricePerNight, notes });
    setSaving(false);
  }

  return (
    <div style={styles.modalOverlay} onClick={onCancel}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.modalTitle}>{existing ? "Editar reserva" : "Nueva reserva"}</h2>

        <label style={styles.label}>Habitación</label>
        <select style={styles.input} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>{r.name} · {r.floor}</option>
          ))}
        </select>

        <label style={styles.label}>Nombre del huésped</label>
        <input
          style={styles.input}
          type="text"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder="Nombre y apellido"
        />

        <div style={styles.formRow}>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>Entrada</label>
            <input style={styles.input} type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>Salida</label>
            <input style={styles.input} type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </div>
        </div>

        <div style={styles.formRow}>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>Origen</label>
            <select style={styles.input} value={source} onChange={(e) => setSource(e.target.value)}>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>Precio por noche (€)</label>
            <input
              style={styles.input}
              type="number"
              min="0"
              value={pricePerNight}
              onChange={(e) => setPricePerNight(e.target.value)}
              placeholder="Ej: 90"
            />
          </div>
        </div>

        <div style={styles.totalBox}>
          <span>{nights} {nights === 1 ? "noche" : "noches"} × {euros(pricePerNight || 0)}</span>
          <strong>{euros(total)}</strong>
        </div>

        <label style={styles.label}>Notas</label>
        <textarea
          style={{ ...styles.input, minHeight: 60, resize: "vertical" }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Alergias, hora de llegada, peticiones especiales..."
        />

        {formError && <div style={styles.formError}>{formError}</div>}

        <div style={styles.modalActions}>
          {onDelete && (
            <button type="button" style={styles.dangerBtn} onClick={onDelete} disabled={saving}>
              Eliminar
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button type="button" style={styles.secondaryBtn} onClick={onCancel} disabled={saving}>Cancelar</button>
          <button type="button" style={styles.primaryBtn} onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : existing ? "Guardar cambios" : "Crear reserva"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Estilos ----------
const COLORS = {
  bg: "#F6F4EF",
  surface: "#FFFFFF",
  ink: "#232019",
  inkSoft: "#6B6355",
  border: "#E7E1D5",
  accent: "#2F5233",
  accentSoft: "#E7EEE5",
  accentSoft2: "#EFEADB",
  danger: "#B23A2E",
  dangerSoft: "#F6E4E1",
};

const shadow = "0 1px 2px rgba(35,32,25,0.04), 0 4px 14px rgba(35,32,25,0.06)";

const styles = {
  app: {
    fontFamily: "'Work Sans', sans-serif",
    background: COLORS.bg,
    color: COLORS.ink,
    minHeight: "100vh",
    padding: "28px 28px 40px",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 12,
  },
  eyebrow: {
    fontSize: 13,
    color: COLORS.inkSoft,
    marginBottom: 2,
    letterSpacing: "0.01em",
  },
  title: {
    fontFamily: "'Fraunces', serif",
    fontWeight: 600,
    fontSize: 30,
    margin: 0,
    letterSpacing: "-0.01em",
  },
  segmentRow: {
    display: "inline-flex",
    background: COLORS.surface,
    borderRadius: 10,
    padding: 4,
    boxShadow: shadow,
    marginBottom: 22,
    gap: 2,
  },
  segmentBtn: {
    border: "none",
    background: "transparent",
    padding: "8px 18px",
    borderRadius: 7,
    fontSize: 13.5,
    fontFamily: "inherit",
    color: COLORS.inkSoft,
    cursor: "pointer",
    fontWeight: 500,
  },
  segmentBtnActive: {
    background: COLORS.accent,
    color: "white",
  },
  statsRow: {
    display: "flex",
    gap: 14,
    marginBottom: 22,
    flexWrap: "wrap",
  },
  statCard: {
    background: COLORS.surface,
    borderRadius: 12,
    padding: "14px 20px",
    boxShadow: shadow,
    minWidth: 150,
    flex: "1 1 150px",
  },
  statNumber: {
    fontFamily: "'Fraunces', serif",
    fontSize: 24,
    fontWeight: 600,
    color: COLORS.accent,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.inkSoft,
    marginTop: 2,
  },
  errorBanner: {
    background: COLORS.dangerSoft,
    color: COLORS.danger,
    padding: "10px 14px",
    borderRadius: 8,
    fontSize: 13,
    marginBottom: 16,
  },
  body: {
    display: "flex",
    gap: 20,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  accountsWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  sidebar: {
    width: 210,
    flexShrink: 0,
    background: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    boxShadow: shadow,
  },
  sidebarTitle: {
    fontFamily: "'Fraunces', serif",
    fontSize: 15,
    margin: "2px 0 12px 2px",
    color: COLORS.ink,
  },
  roomItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 9,
    width: "100%",
    textAlign: "left",
    background: "transparent",
    border: "none",
    borderRadius: 8,
    padding: "8px 8px",
    fontSize: 13.5,
    color: COLORS.ink,
    cursor: "pointer",
    fontFamily: "inherit",
    marginBottom: 2,
  },
  roomItemActive: {
    background: COLORS.accentSoft,
    fontWeight: 600,
  },
  roomItemName: {
    lineHeight: 1.3,
  },
  roomFloor: {
    display: "block",
    fontSize: 11,
    color: COLORS.inkSoft,
    fontWeight: 400,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: "50%",
    flexShrink: 0,
    marginTop: 3,
  },
  main: {
    flex: 1,
    minWidth: 340,
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  card: {
    background: COLORS.surface,
    borderRadius: 14,
    padding: 20,
    boxShadow: shadow,
  },
  calHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    marginBottom: 16,
  },
  calMonthLabel: {
    fontFamily: "'Fraunces', serif",
    fontSize: 19,
    minWidth: 170,
    textAlign: "center",
  },
  navBtn: {
    background: COLORS.accentSoft,
    border: "none",
    borderRadius: 8,
    width: 32,
    height: 32,
    cursor: "pointer",
    fontSize: 16,
    color: COLORS.accent,
    lineHeight: 1,
  },
  dowRow: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    marginBottom: 6,
  },
  dowCell: {
    textAlign: "center",
    fontSize: 11,
    color: COLORS.inkSoft,
    padding: "4px 0",
    fontWeight: 500,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 6,
  },
  dayCell: {
    minHeight: 74,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    padding: 5,
    fontSize: 11,
    background: COLORS.surface,
  },
  dayCellEmpty: {
    border: "1px solid transparent",
    background: "transparent",
  },
  dayCellWeekend: {
    background: "#FBF9F5",
  },
  dayCellToday: {
    borderColor: COLORS.accent,
    borderWidth: 1.5,
  },
  dayNumber: {
    fontSize: 11,
    color: COLORS.inkSoft,
    marginBottom: 3,
  },
  dayNumberToday: {
    color: COLORS.accent,
    fontWeight: 600,
  },
  dayBars: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  dayBar: {
    color: "white",
    fontSize: 9.5,
    padding: "2px 4px",
    borderRadius: 4,
    cursor: "pointer",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  moreLabel: {
    fontSize: 9.5,
    color: COLORS.inkSoft,
  },
  tabRow: {
    display: "flex",
    gap: 4,
    marginBottom: 14,
    borderBottom: `1px solid ${COLORS.border}`,
  },
  tabBtn: {
    background: "transparent",
    border: "none",
    padding: "6px 10px 12px 4px",
    fontSize: 13.5,
    color: COLORS.inkSoft,
    cursor: "pointer",
    borderBottom: "2px solid transparent",
    fontFamily: "inherit",
    marginBottom: -1,
  },
  tabBtnActive: {
    color: COLORS.accent,
    borderBottom: `2px solid ${COLORS.accent}`,
    fontWeight: 600,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  emptyState: {
    color: COLORS.inkSoft,
    fontSize: 13.5,
    padding: "24px 0",
    textAlign: "center",
  },
  resoRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "12px 4px",
    borderBottom: `1px solid ${COLORS.border}`,
  },
  resoInfo: {
    flex: 1,
  },
  resoTop: {
    display: "flex",
    gap: 8,
    alignItems: "baseline",
    fontSize: 14,
    flexWrap: "wrap",
  },
  resoRoom: {
    fontSize: 12,
    color: COLORS.inkSoft,
  },
  resoDates: {
    fontSize: 12,
    color: COLORS.inkSoft,
    marginTop: 3,
  },
  resoNotes: {
    fontSize: 12,
    color: COLORS.ink,
    marginTop: 5,
    fontStyle: "italic",
  },
  resoActions: {
    display: "flex",
    gap: 8,
    paddingTop: 2,
  },
  resoTotal: {
    fontFamily: "'Fraunces', serif",
    fontSize: 15,
    color: COLORS.accent,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  linkBtn: {
    background: "transparent",
    border: "none",
    color: COLORS.accent,
    fontSize: 12.5,
    cursor: "pointer",
    padding: 0,
    fontWeight: 500,
  },
  primaryBtn: {
    background: COLORS.accent,
    color: "white",
    border: "none",
    borderRadius: 8,
    padding: "10px 18px",
    fontSize: 13.5,
    cursor: "pointer",
    fontFamily: "inherit",
    fontWeight: 500,
  },
  secondaryBtn: {
    background: "transparent",
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    padding: "10px 16px",
    fontSize: 13.5,
    cursor: "pointer",
    fontFamily: "inherit",
    color: COLORS.ink,
  },
  dangerBtn: {
    background: "transparent",
    border: "none",
    color: COLORS.danger,
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "inherit",
    padding: "10px 4px",
    fontWeight: 500,
  },
  totalBox: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: COLORS.accentSoft,
    borderRadius: 8,
    padding: "10px 14px",
    marginTop: 12,
    fontSize: 13,
    color: COLORS.ink,
  },
  barsChart: {
    display: "flex",
    gap: 14,
    alignItems: "flex-end",
    height: 160,
    padding: "0 6px",
  },
  barsCol: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    height: "100%",
  },
  barsValue: {
    fontSize: 10.5,
    color: COLORS.inkSoft,
    marginBottom: 4,
  },
  barsTrack: {
    flex: 1,
    width: "60%",
    display: "flex",
    alignItems: "flex-end",
  },
  barsFill: {
    width: "100%",
    borderRadius: "5px 5px 0 0",
    transition: "height 0.2s ease",
  },
  barsLabel: {
    fontSize: 11,
    color: COLORS.inkSoft,
    marginTop: 6,
  },
  accountsNote: {
    fontSize: 12,
    color: COLORS.inkSoft,
    marginTop: 4,
    fontStyle: "italic",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(35,32,25,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    padding: 16,
    boxSizing: "border-box",
  },
  modal: {
    background: COLORS.surface,
    borderRadius: 16,
    padding: 26,
    width: 400,
    maxWidth: "90vw",
    maxHeight: "85vh",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    boxShadow: "0 20px 60px rgba(35,32,25,0.25)",
  },
  modalTitle: {
    fontFamily: "'Fraunces', serif",
    fontSize: 21,
    margin: "0 0 12px 0",
  },
  label: {
    fontSize: 12,
    color: COLORS.inkSoft,
    marginTop: 10,
    fontWeight: 500,
  },
  input: {
    padding: "9px 11px",
    borderRadius: 8,
    border: `1px solid ${COLORS.border}`,
    fontSize: 14,
    fontFamily: "inherit",
    width: "100%",
    boxSizing: "border-box",
    marginTop: 4,
    background: "#FBFAF7",
  },
  formRow: {
    display: "flex",
    gap: 10,
  },
  formError: {
    color: COLORS.danger,
    fontSize: 12,
    marginTop: 8,
  },
  modalActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 18,
  },
};
