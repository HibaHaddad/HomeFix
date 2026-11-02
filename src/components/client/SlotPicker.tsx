"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { dateLabel } from "@/lib/client-domain";
export type Slot = { id: number; startsAt: string; endsAt: string };
export function tunisDay(value: string | Date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)); }
export default function SlotPicker({ professionalId, value, onChange }: { professionalId: number; value: number | null; onChange: (slot: Slot | null) => void }) {
  const [month, setMonth] = useState(() => tunisDay(new Date()).slice(0, 7));
  const [day, setDay] = useState(""); const [slots, setSlots] = useState<Slot[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [retry, setRetry] = useState(0);
  const selection = useRef({ value, onChange });
  useEffect(() => { selection.current = { value, onChange }; }, [value, onChange]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(""); setSlots([]); setDay("");
    let inFlight = false;
    const refresh = async () => {
      if (inFlight) return; inFlight = true;
      try {
        const response = await fetch(`/api/client/professionnels/${professionalId}/disponibilites?month=${month}`, { signal: controller.signal, cache: "no-store" });
        const data = await response.json(); if (!response.ok) throw new Error(data.error);
        if (controller.signal.aborted) return;
        const available: Slot[] = data.slots; setSlots(available); setError("");
        setDay((current) => current || (available[0] ? tunisDay(available[0].startsAt) : ""));
        if (selection.current.value && !available.some((s) => s.id === selection.current.value)) selection.current.onChange(null);
      } catch (e) { if (!controller.signal.aborted) { setSlots([]); selection.current.onChange(null); setError(e instanceof Error ? e.message : "Agenda indisponible."); } }
      finally { inFlight = false; if (!controller.signal.aborted) setLoading(false); }
    };
    void refresh(); const update = () => { if (document.visibilityState === "visible") void refresh(); };
    const timer = setInterval(update, 15000); window.addEventListener("focus", update);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener("focus", update); };
  }, [professionalId, month, retry]);
  const [year, m] = month.split("-").map(Number);
  const offset = (new Date(Date.UTC(year, m - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, m, 0)).getUTCDate();
  function move(n: number) { setMonth(new Date(Date.UTC(year, m - 1 + n, 1)).toISOString().slice(0, 7)); onChange(null); }
  return <div className="flow-slot-picker" aria-busy={loading}><div className="flow-calendar-toolbar"><strong><CalendarDays size={16}/>{new Date(`${month}-01T12:00:00Z`).toLocaleDateString("fr-TN", { month: "long", year: "numeric", timeZone: "UTC" })}</strong><div><button type="button" className="cx-icon-btn" onClick={() => move(-1)} aria-label="Mois précédent"><ChevronLeft size={16}/></button><button type="button" className="cx-icon-btn" onClick={() => move(1)} aria-label="Mois suivant"><ChevronRight size={16}/></button></div></div>
    <div className="flow-days">{["L", "M", "M", "J", "V", "S", "D"].map((d, i) => <small key={i}>{d}</small>)}{Array.from({ length: offset }, (_, i) => <span key={`empty-${i}`}/>)}{Array.from({ length: days }, (_, i) => { const key = `${month}-${String(i + 1).padStart(2, "0")}`; const available = !loading && slots.some((s) => tunisDay(s.startsAt) === key); return <button type="button" key={key} disabled={!available} aria-pressed={day === key} aria-label={`${i + 1} ${month}${available ? ", créneaux disponibles" : ", indisponible"}`} className={day === key ? "is-selected" : ""} onClick={() => { setDay(key); onChange(null); }}>{i + 1}{available && <i/>}</button>; })}</div>
    {loading ? <p className="flow-note" role="status">Chargement des disponibilités réelles…</p> : error ? <p className="cx-feedback is-error" role="alert">{error}<button className="cx-text-btn" type="button" onClick={() => setRetry((n) => n + 1)}>Réessayer</button></p> : !slots.length ? <p className="flow-note">Aucun créneau publié ce mois-ci. Consultez un autre mois ou échangez avec le professionnel.</p> : <div className="flow-slots" role="group" aria-label="Créneaux disponibles">{slots.filter((s) => tunisDay(s.startsAt) === day).map((s) => <button type="button" key={s.id} aria-pressed={value === s.id} className={value === s.id ? "is-selected" : ""} onClick={() => onChange(s)}>{new Date(s.startsAt).toLocaleTimeString("fr-TN", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Tunis" })} – {new Date(s.endsAt).toLocaleTimeString("fr-TN", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Tunis" })}</button>)}</div>}
    {value && <small className="flow-note">Créneau choisi : {slots.find((s) => s.id === value) ? dateLabel(slots.find((s) => s.id === value)!.startsAt) : "à vérifier"} · heure de Tunis</small>}
  </div>;
}
