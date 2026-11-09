"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, MessageSquare, RotateCcw, Star, Wrench } from "lucide-react";
import styles from "./ProfessionalReviews.module.css";

type Review = {
  id: number;
  rating: number | null;
  comment: string;
  createdAt: string;
  client: { name: string };
  request: { id: number; title: string } | null;
};

const PAGE_SIZE = 8;

export default function ProfessionalReviewsList({ reviews }: { reviews: Review[] }) {
  const [selectedDate, setSelectedDate] = useState("");
  const [intervention, setIntervention] = useState("");
  const [page, setPage] = useState(1);
  const rated = reviews.filter((review) => review.rating !== null);
  const average = rated.length ? (rated.reduce((sum, review) => sum + review.rating!, 0) / rated.length).toFixed(1) : "—";
  const interventions = Array.from(new Map(reviews.flatMap((review) => review.request ? [[review.request.id, review.request] as const] : [])).values());
  const filtered = reviews.filter((review) => {
    // Match the selected calendar day in Tunisia.
    const date = new Date(new Date(review.createdAt).getTime() + 3600000).toISOString().slice(0, 10);
    return (!selectedDate || date === selectedDate)
      && (!intervention || (intervention === "none" ? !review.request : String(review.request?.id) === intervention));
  });
  const hasFilters = Boolean(selectedDate || intervention);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const reset = () => { setSelectedDate(""); setIntervention(""); setPage(1); };

  return <section className={styles.panel} aria-label="Avis publiés de vos clients">
    <div className={styles.summary}><strong>{average}</strong><div><div className={styles.stars}><Star size={17} fill="currentColor" /><span>sur 5</span></div><p>{reviews.length} avis publié{reviews.length > 1 ? "s" : ""} <span>· Toutes les interventions</span></p></div></div>
    <div className={styles.filters}>
      <label><span><CalendarDays size={13} />Date</span><input type="date" value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); setPage(1); }} /></label>
      <label className={styles.intervention}><span><Wrench size={13} />Intervention</span><select value={intervention} onChange={(event) => { setIntervention(event.target.value); setPage(1); }}><option value="">Toutes les interventions</option>{interventions.map((request) => <option key={request.id} value={request.id}>{request.title}</option>)}{reviews.some((review) => !review.request) && <option value="none">Sans intervention associée</option>}</select></label>
      {hasFilters && <button className={styles.reset} type="button" onClick={reset}><RotateCcw size={13} />Réinitialiser</button>}
    </div>
    <p className={styles.count} role="status">{filtered.length} avis{hasFilters ? " correspondant aux filtres" : " au total"}{filtered.length > PAGE_SIZE && ` · Avis ${startIndex + 1} à ${Math.min(startIndex + PAGE_SIZE, filtered.length)}`}</p>
    <div className={styles.list}>{filtered.slice(startIndex, startIndex + PAGE_SIZE).map((review) => <article key={review.id} className={styles.review}>
      <header><div><strong>{review.client.name}</strong>{review.request && <p>{review.request.title}</p>}</div><time dateTime={review.createdAt}>{new Date(review.createdAt).toLocaleDateString("fr-TN", { timeZone: "Africa/Tunis" })}</time></header>
      <div className={styles.stars} aria-label={review.rating !== null ? `${review.rating} sur 5` : "Avis sans note"}>{review.rating !== null ? <>{[1, 2, 3, 4, 5].map((n) => <Star aria-hidden="true" key={n} size={14} fill={n <= review.rating! ? "currentColor" : "none"} />)}<span>{review.rating}/5</span></> : <span>Avis écrit</span>}</div>
      {review.comment && <p className={styles.comment}>{review.comment}</p>}
    </article>)}</div>
    {!filtered.length && <div className={styles.empty}><MessageSquare size={21} /><p>{hasFilters ? "Aucun avis ne correspond à ces filtres." : "Les avis apparaîtront après le paiement confirmé des interventions."}</p>{hasFilters && <button type="button" onClick={reset}>Afficher tous les avis</button>}</div>}
    {pageCount > 1 && <nav className={styles.pagination} aria-label="Pagination des avis">
      <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={14} />Précédent</button>
      <span aria-live="polite">Page {currentPage} sur {pageCount}</span>
      <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Suivant<ChevronRight size={14} /></button>
    </nav>}
  </section>;
}
