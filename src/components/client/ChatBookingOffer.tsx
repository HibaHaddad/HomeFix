"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle } from "lucide-react";
import type { ChatMessage } from "@/lib/chat-types";
import { money } from "@/lib/client-domain";
import { bookingRangeLabel } from "@/lib/booking-message";
import { workspaceAction } from "./WorkspaceForm";

export default function ChatBookingOffer({ quote, professional, onChange }: { quote: NonNullable<ChatMessage["quote"]>; professional: boolean; onChange: () => void }) {
  const router = useRouter(); const lock = useRef(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [accepted, setAccepted] = useState(false);
  const booking = quote.request.booking;
  const confirmed = accepted || quote.status === "ACCEPTED";
  const available = quote.status === "PENDING" && quote.request.status === "QUOTED" && booking?.status === "ACCEPTED" && +new Date(quote.validUntil) > Date.now() && +new Date(booking.startsAt) > Date.now();
  return <section className="rt-booking-offer" aria-label="Confirmation du prix de l’intervention"><span className="rt-offer-label">{confirmed ? "PRIX CONFIRMÉ" : "PRIX PROPOSÉ"}</span><strong className="rt-offer-price">{money(quote.amountMillimes)}</strong>{booking && <p>{bookingRangeLabel(new Date(booking.startsAt), new Date(booking.endsAt))}</p>}
    {confirmed ? <div className="rt-offer-confirmed" role="status"><Check size={16}/>Prix confirmé{booking?.status === "CONFIRMED" || accepted ? " · intervention confirmée" : ""}</div> : professional ? <p>{quote.status === "PENDING" ? "En attente de la confirmation du client." : "Cette proposition n’est plus disponible."}</p> : available ? <button type="button" className="cx-btn" disabled={busy} onClick={async () => {
      if (lock.current) return; lock.current = true; setBusy(true); setError("");
      try { await workspaceAction("quote.accept", { requestId: quote.requestId, quoteId: quote.id }); setAccepted(true); onChange(); router.refresh(); }
      catch (e) { setError(e instanceof Error ? e.message : "Confirmation impossible."); onChange(); }
      finally { lock.current = false; setBusy(false); }
    }}>{busy ? <LoaderCircle size={16} className="cx-spin"/> : <Check size={16}/>} {busy ? "Confirmation…" : "Confirmer"}</button> : <p>{quote.status === "SUPERSEDED" ? "Ce prix a été remplacé par une nouvelle proposition." : "Cette proposition n’est plus disponible à la confirmation."}</p>}
    {error && <p className="cx-feedback is-error" role="alert">{error}</p>}
  </section>;
}
