"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, LoaderCircle, Pencil, Plus, X } from "lucide-react";
import { blockingBookingStatuses, tunisDay, tunisTime } from "@/lib/availability";
import { money, statusLabels } from "@/lib/client-domain";
import { workspaceAction } from "@/components/client/WorkspaceForm";
import { getChatSocket } from "@/lib/chat-socket";

type Slot = { id: number; startsAt: string; endsAt: string };
type Appointment = Slot & { requestId: number; status: string; request: { title: string; conversationId: number | null; client: { name: string }; quotes: { id: number; amountMillimes: number; status: string }[] } };
type Agenda = { slots: Slot[]; appointments: Appointment[] };
const overlaps = (a: Slot, b: Slot) => new Date(a.startsAt) < new Date(b.endsAt) && new Date(a.endsAt) > new Date(b.startsAt);
const held = (a: Appointment) => blockingBookingStatuses.includes(a.status);
const confirmed = (a: Appointment) => a.status === "CONFIRMED";
const labelDay = (day: string) => new Date(`${day}T12:00:00+01:00`).toLocaleDateString("fr-TN", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Tunis" });

export default function AvailabilityCalendar() {
  const [today] = useState(() => tunisDay(new Date()));
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const [agenda, setAgenda] = useState<Agenda>({ slots: [], appointments: [] });
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [busy, setBusy] = useState(false); const [saveError, setSaveError] = useState("");
  const [start, setStart] = useState("09:00"); const [end, setEnd] = useState("17:00");
  const [saved, setSaved] = useState("");
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [confirmationError, setConfirmationError] = useState<{ id: number; message: string } | null>(null);
  const confirmationLock = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null); const dialogTitle = useId(); const version = useRef(0);
  const reload = useCallback(async (signal?: AbortSignal) => {
    const current = ++version.current;
    const response = await fetch(`/api/interactions?month=${month}`, { cache: "no-store", signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Agenda indisponible.");
    if (!signal?.aborted && current === version.current) { setAgenda(data); setError(""); setLoading(false); }
  }, [month]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setAgenda({ slots: [], appointments: [] });
    const refresh = () => { void reload(controller.signal).catch((e) => { if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : "Agenda indisponible."); setLoading(false); } }); };
    refresh(); const timer = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 15000);
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [reload]);
  useEffect(() => {
    const socket = getChatSocket();
    const refresh = () => { void reload().catch(() => {}); };
    socket.on("chat:message-updated", refresh); socket.on("intervention:updated", refresh);
    return () => { socket.off("chat:message-updated", refresh); socket.off("intervention:updated", refresh); };
  }, [reload]);

  const daySlots = agenda.slots.filter((s) => tunisDay(s.startsAt) === selected);
  const dayAppointments = agenda.appointments.filter((a) => tunisDay(a.startsAt) <= selected && tunisDay(new Date(+new Date(a.endsAt) - 1)) >= selected);
  const occupied = dayAppointments.filter(held);
  const free = daySlots.filter((s) => +new Date(s.startsAt) > Date.now() && !occupied.some((a) => overlaps(s, a)));
  async function confirmAppointment(appointment: Appointment, amount: string) {
    if (confirmationLock.current) return;
    confirmationLock.current = true; setConfirmingId(appointment.id); setConfirmationError(null); setSaved("");
    try {
      const result = await workspaceAction("booking.confirm", { requestId: appointment.requestId, amount }, true);
      // Update the card immediately, even if the following agenda refresh fails.
      setAgenda((current) => ({ ...current, appointments: current.appointments.map((a) => a.id === appointment.id ? { ...a, status: result.bookingStatus || "ACCEPTED", request: { ...a.request, quotes: result.quoteId ? [{ id: result.quoteId, amountMillimes: Math.round(Number(amount) * 1000), status: "PENDING" }] : a.request.quotes } } : a) }));
      setSaved("Créneau et prix envoyés au client pour confirmation.");
      try { await reload(); } catch { /* Keep the successfully updated card. */ }
    } catch (e) {
      setConfirmationError({ id: appointment.id, message: e instanceof Error ? e.message : "Confirmation impossible. Réessayez." });
      void reload().catch(() => {});
    } finally { confirmationLock.current = false; setConfirmingId(null); }
  }
  function openEditor(day: string) {
    const slots = agenda.slots.filter((s) => tunisDay(s.startsAt) === day);
    setSelected(day); setSaveError("");
    setStart(slots.length ? tunisTime(slots[0].startsAt) : "09:00");
    setEnd(slots.length ? tunisTime(slots[slots.length - 1].endsAt) : "17:00");
    dialog.current?.showModal();
  }
  function selectDay(day: string) {
    setSelected(day); setSaved("");
    if (day >= today && !agenda.slots.some((s) => tunisDay(s.startsAt) === day)) openEditor(day);
  }
  function moveMonth(delta: number) {
    const [year, m] = month.split("-").map(Number);
    setMonth(new Date(Date.UTC(year, m - 1 + delta, 1)).toISOString().slice(0, 7)); setSelected(""); setSaved("");
  }
  const [year, monthNumber] = month.split("-").map(Number);
  const offset = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;
  const totalDays = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const monthLabel = new Date(`${month}-01T12:00:00Z`).toLocaleDateString("fr-TN", { month: "long", year: "numeric", timeZone: "Africa/Tunis" });

  return <>
    {error && <p className="cx-feedback is-error" role="alert">{error}<button className="cx-text-btn" onClick={() => { setLoading(true); void reload().catch((e) => { setError(e.message); setLoading(false); }); }}>Réessayer</button></p>}
    {saved && <p className="agenda-success" role="status"><Check size={16}/>{saved}</p>}
    <section className="pro-calendar-layout agenda-layout" aria-label="Disponibilités et réservations" aria-busy={loading}>
      <div className="pro-panel pro-calendar-panel"><div className="pro-calendar-toolbar"><div><span className="pro-calendar-eyebrow">VOTRE TEMPS, VOTRE ORGANISATION</span><h2>{monthLabel}</h2></div><div className="pro-calendar-controls"><button type="button" disabled={busy || confirmingId !== null} aria-label="Mois précédent" onClick={() => moveMonth(-1)}><ChevronLeft size={17}/></button><button type="button" disabled={busy || confirmingId !== null} onClick={() => { setMonth(today.slice(0, 7)); setSelected(today); }}>Aujourd’hui</button><button type="button" disabled={busy || confirmingId !== null} aria-label="Mois suivant" onClick={() => moveMonth(1)}><ChevronRight size={17}/></button></div></div>
        <p className="agenda-hint"><Clock3 size={14}/>Cliquez sur une date pour organiser votre journée · heure de Tunis</p>
        <div className="pro-calendar-grid" role="grid" aria-label={monthLabel}>
          {["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."].map((day) => <div className="pro-calendar-weekday" role="columnheader" key={day}>{day}</div>)}
          {Array.from({ length: Math.ceil((offset + totalDays) / 7) * 7 }, (_, i) => {
            const number = i - offset + 1;
            if (number < 1 || number > totalDays) return <span role="gridcell" key={i} aria-hidden="true"/>;
            const key = `${month}-${String(number).padStart(2, "0")}`;
            const slots = agenda.slots.filter((s) => tunisDay(s.startsAt) === key);
            const bookings = agenda.appointments.filter((a) => held(a) && tunisDay(a.startsAt) <= key && tunisDay(new Date(+new Date(a.endsAt) - 1)) >= key);
            const available = slots.some((s) => +new Date(s.startsAt) > Date.now() && !bookings.some((a) => overlaps(s, a)));
            const full = !available && (slots.length > 0 || bookings.length > 0) && key >= today;
            const state = key < today ? "past" : available ? "available" : full ? "full" : "unavailable";
            return <div role="gridcell" className="pro-calendar-cell" key={key}><button type="button" disabled={loading || Boolean(error) || busy || confirmingId !== null} className={`pro-calendar-day agenda-day is-${state}${key === today ? " is-today" : ""}${selected === key ? " is-selected" : ""}`} aria-pressed={selected === key} aria-label={`${labelDay(key)} : ${available ? "disponible" : full ? "complet" : "sans disponibilité"}`} onClick={() => selectDay(key)}><span>{number}</span><i/>{bookings.length > 0 && <small className="pro-day-booking-count">{bookings.length}</small>}</button></div>;
          })}
        </div><div className="agenda-legend"><span><i className="available"/>Disponible</span><span><i className="full"/>Complet / en attente</span><span><i/>Sans disponibilité</span></div>
      </div>
      <aside className="pro-panel pro-calendar-day-panel agenda-day-panel"><div className="pro-calendar-day-date"><span className="pro-calendar-day-icon"><CalendarDays size={20}/></span><div><small>VOTRE JOURNÉE</small><h3>{selected ? labelDay(selected) : "Sélectionnez une date"}</h3></div></div>
        {loading ? <p className="agenda-hint" role="status"><LoaderCircle className="cx-spin" size={16}/>Chargement de l’agenda…</p> : selected && <>
          <div className="agenda-day-summary"><div><strong>{free.length}</strong><span>créneau{free.length > 1 ? "x" : ""} libre{free.length > 1 ? "s" : ""}</span></div><div><strong>{occupied.length}</strong><span>réservation{occupied.length > 1 ? "s" : ""}</span></div></div>
          {selected >= today && <button type="button" className="cx-btn secondary agenda-edit" disabled={Boolean(error) || confirmingId !== null} onClick={() => openEditor(selected)}>{daySlots.length ? <Pencil size={15}/> : <Plus size={15}/>} {daySlots.length ? "Modifier les horaires" : "Ajouter des horaires"}</button>}
          <div className="agenda-section-title"><h4>Disponibilités</h4><small>Créneaux de 1 h</small></div>
          {daySlots.length ? <div className="agenda-hours">{daySlots.map((s) => { const booking = occupied.find((a) => overlaps(s, a)); const past = +new Date(s.startsAt) <= Date.now(); return <div key={s.id} className={`agenda-hour ${booking ? confirmed(booking) ? "confirmed" : "pending" : past ? "past" : "free"}`}><strong>{tunisTime(s.startsAt)} – {tunisTime(s.endsAt)}</strong><small>{booking ? confirmed(booking) ? "Confirmé" : "En attente" : past ? "Passé" : "Libre"}</small></div>; })}</div> : <p className="agenda-empty">Aucun horaire publié pour cette date.</p>}
          <div className="agenda-section-title"><h4>Réservations</h4><small>{dayAppointments.length}</small></div>
          {dayAppointments.length ? <div className="agenda-bookings">{dayAppointments.map((a) => <article key={a.id} className={`agenda-booking ${confirmed(a) ? "confirmed" : held(a) ? "pending" : "cancelled"}`} ><div><strong>{tunisTime(a.startsAt)} – {tunisTime(a.endsAt)}</strong><span>{confirmed(a) ? "Confirmée" : a.status === "ACCEPTED" ? "Confirmation client attendue" : statusLabels[a.status] || a.status}</span></div><h5>{a.request.client.name}</h5><p>{a.request.title}</p>{a.status === "ACCEPTED" && a.request.quotes[0]?.status === "PENDING" && <p>Prix envoyé : <strong>{money(a.request.quotes[0].amountMillimes)}</strong></p>}<div className="agenda-booking-actions">{["PROPOSED", "ACCEPTED"].includes(a.status) && !a.request.quotes.some((q) => q.status === "ACCEPTED") && !(a.status === "ACCEPTED" && a.request.quotes.some((q) => q.status === "PENDING")) && +new Date(a.startsAt) > Date.now() && <form className="agenda-price-form" onSubmit={(event) => { event.preventDefault(); void confirmAppointment(a, String(new FormData(event.currentTarget).get("amount"))); }}><label>Prix de l’intervention (TND)<input type="number" name="amount" required min="1" max="1000000" step="0.001" defaultValue={a.request.quotes[0] ? a.request.quotes[0].amountMillimes / 1000 : ""} placeholder="Ex. 80" disabled={confirmingId !== null || busy}/></label><button type="submit" className="cx-btn agenda-confirm" disabled={confirmingId !== null || busy}>{confirmingId === a.id ? <LoaderCircle size={15} className="cx-spin"/> : <Check size={15}/>} {confirmingId === a.id ? "Envoi…" : "Confirmer et envoyer le prix"}</button></form>}<Link href={`/professionnel/messagerie?demande=${a.request.conversationId ?? a.requestId}`}>Voir la conversation ↗</Link></div>{confirmationError?.id === a.id && <p className="cx-feedback is-error" role="alert">{confirmationError.message}</p>}</article>)}</div> : <p className="agenda-empty">Aucune réservation ce jour.</p>}
        </>}
        <p className="pro-calendar-note">Les demandes en attente bloquent leur créneau. Le client confirme le créneau et le prix directement depuis le message reçu.</p>
      </aside>
    </section>
    <dialog ref={dialog} className="agenda-dialog" aria-labelledby={dialogTitle} onCancel={(e) => { if (busy) e.preventDefault(); }}><div className="agenda-dialog-heading"><span className="agenda-dialog-icon"><Clock3 size={23}/></span><button type="button" aria-label="Fermer" disabled={busy || confirmingId !== null} onClick={() => dialog.current?.close()}><X size={20}/></button></div><span className="pro-calendar-eyebrow">VOS DISPONIBILITÉS</span><h2 id={dialogTitle}>{daySlots.length ? "Modifier les horaires" : "Organisez votre journée"}</h2><p className="agenda-dialog-date">{selected && labelDay(selected)}</p>
      <form className="cx-form" onSubmit={async (event) => {
        event.preventDefault(); if (busy) return; setBusy(true); setSaveError("");
        try {
          await workspaceAction("availability.save", { day: selected, start, end }, true);
          await reload(); setSaved("Disponibilités enregistrées. Vos réservations existantes sont conservées."); dialog.current?.close();
        } catch (e) { setSaveError(e instanceof Error ? e.message : "Enregistrement impossible."); }
        finally { setBusy(false); }
      }}><div className="agenda-time-fields"><label>Heure de début<input type="time" step="900" required value={start} onChange={(e) => setStart(e.target.value)} disabled={busy || confirmingId !== null}/></label><span>—</span><label>Heure de fin<input type="time" step="900" required value={end} onChange={(e) => setEnd(e.target.value)} disabled={busy || confirmingId !== null}/></label></div><p className="agenda-dialog-info">Votre plage sera découpée en créneaux réservables d’une heure. Exemple : 09:00–17:00 donne 8 créneaux.</p>{occupied.length > 0 && <p className="agenda-dialog-preserve"><ShieldNotice/>Les réservations déjà enregistrées gardent leurs horaires, même en dehors de la nouvelle plage.</p>}{saveError && <p className="cx-feedback is-error" role="alert">{saveError}</p>}<button type="submit" className="cx-btn" disabled={busy || confirmingId !== null}>{busy ? <LoaderCircle size={17} className="cx-spin"/> : <Check size={17}/>} {busy ? "Enregistrement…" : "Enregistrer la disponibilité"}</button></form>
    </dialog>
  </>;
}
function ShieldNotice() { return <Check size={16} aria-hidden="true"/>; }
