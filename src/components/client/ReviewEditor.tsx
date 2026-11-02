"use client";
import { useState } from "react";
import { LoaderCircle, Star, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { workspaceAction } from "./WorkspaceForm";
import { REVIEW_EDIT_MS } from "@/lib/payment-rules";
type Review = { rating: number | null; comment: string; createdAt: string; published: boolean };
export default function ReviewEditor({ requestId, review }: { requestId: number; review?: Review | null }) {
  const router = useRouter();
  const [rating, setRating] = useState<number | null>(review?.rating ?? null), [comment, setComment] = useState(review?.comment || ""), [saved, setSaved] = useState(Boolean(review)), [editing, setEditing] = useState(!review), [busy, setBusy] = useState(false), [feedback, setFeedback] = useState(""), [error, setError] = useState(false);
  const [createdAt, setCreatedAt] = useState(review?.createdAt);
  const [publishedContent, setPublishedContent] = useState({ rating: review?.rating ?? null, comment: review?.comment || "" });
  const editable = !createdAt || Date.now() < +new Date(createdAt) + REVIEW_EDIT_MS;
  if (!editing) return <div className="hf-review"><div className="hf-review-stars" aria-label={rating ? `${rating} sur 5` : "Avis sans note"}>{rating ? [1, 2, 3, 4, 5].map((n) => <Star key={n} size={20} fill={n <= rating ? "currentColor" : "none"}/>) : <span>Avis écrit</span>}</div>{comment && <p className="cx-pre-wrap">{comment}</p>}<div className="cx-actions"><span className="hf-paid"><Check size={14}/>{review?.published === false ? "En attente de modération" : "Avis publié"}</span>{editable && <button type="button" className="cx-text-btn" onClick={() => setEditing(true)}>Modifier mon avis</button>}</div><small>Modifiable pendant 7 jours après publication.</small></div>;
  return <form className="cx-form hf-review" onSubmit={async (e) => {
    e.preventDefault(); if (busy) return; setBusy(true); setFeedback("");
    try { await workspaceAction(saved ? "review.update" : "review.create", { requestId, rating, comment }); setSaved(true); setPublishedContent({ rating, comment }); setCreatedAt(createdAt || new Date().toISOString()); setEditing(false); setError(false); setFeedback("Votre avis est publié. Merci !"); router.refresh(); }
    catch (err) { setError(true); setFeedback(err instanceof Error ? err.message : "Connexion impossible."); }
    finally { setBusy(false); }
  }}><fieldset disabled={busy}><legend>Votre expérience</legend><div className="hf-star-picker">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" aria-label={`${n} étoile${n > 1 ? "s" : ""}`} aria-pressed={rating === n} onClick={() => setRating(n)}><Star size={30} fill={rating !== null && n <= rating ? "currentColor" : "none"}/></button>)}</div>{rating !== null && <button type="button" className="cx-text-btn" onClick={() => setRating(null)}>Retirer la note</button>}<label>Votre commentaire<textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={3000} rows={3} placeholder="Qu’avez-vous apprécié ?"/></label><small>Une note ou un commentaire suffit. Votre avis sera publié sur le profil du professionnel.</small></fieldset><div className="cx-actions"><button className="cx-btn" disabled={busy || (!rating && !comment.trim())} type="submit">{busy && <LoaderCircle size={16} className="cx-spin"/>}{saved ? "Enregistrer les modifications" : "Publier mon avis"}</button>{saved && <button type="button" className="cx-text-btn" onClick={() => { setRating(publishedContent.rating); setComment(publishedContent.comment); setEditing(false); }}>Annuler</button>}</div>{feedback && <p className={`cx-feedback ${error ? "is-error" : ""}`} role={error ? "alert" : "status"}>{feedback}</p>}</form>;
}
