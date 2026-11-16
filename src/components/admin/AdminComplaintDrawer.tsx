"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, RefreshCw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import AdminComplaintCase, { type ComplaintCase } from "./AdminComplaintCase";

export default function AdminComplaintDrawer({ complaintId, onClose }: { complaintId: number; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [complaint, setComplaint] = useState<ComplaintCase | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const load = useCallback(async (signal?: AbortSignal) => {
    setError(""); setLoading(true);
    try {
      const response = await fetch(`/api/admin/reclamations/${complaintId}`, { signal, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Chargement impossible.");
      if (!signal?.aborted) setComplaint(data);
    } catch (error) {
      if (!signal?.aborted) setError(error instanceof Error ? error.message : "Connexion impossible.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [complaintId]);
  useEffect(() => {
    const controller = new AbortController();
    if (!dialog.current?.open) dialog.current?.showModal();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  return <dialog ref={dialog} className="admin-complaint-drawer" aria-labelledby="cc-drawer-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left) onClose(); } }}>
    <header className="cc-drawer-header"><div><span>RÉCLAMATION · RÉF. REC-{String(complaintId).padStart(4, "0")}</span><h2 id="cc-drawer-title">{complaint?.subject ?? "Détail de la réclamation"}</h2></div><button className="admin-icon-button" onClick={onClose} aria-label="Fermer le panneau"><X size={20}/></button></header>
    {error ? <div className="cc-drawer-state" role="alert"><p>{error}</p><button className="admin-button admin-button-light" onClick={() => void load()}><RefreshCw size={15}/>Réessayer</button></div> : !complaint && loading ? <div className="cc-drawer-state" role="status"><LoaderCircle size={24} className="cc-spinner"/><p>Chargement du dossier…</p></div> : complaint && <AdminComplaintCase complaint={complaint} onUpdated={async () => { await load(); router.refresh(); }}/>} 
  </dialog>;
}
