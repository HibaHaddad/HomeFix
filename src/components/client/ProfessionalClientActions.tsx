"use client";
import { Heart, Link2 } from "lucide-react";
import WorkspaceForm from "./WorkspaceForm";
export default function ProfessionalClientActions({ professionalId, favorite, unassigned }: { professionalId: number; favorite: boolean; unassigned: { id: number; title: string }[] }) {
  return <section className="client-panel"><WorkspaceForm action={favorite ? "favorite.remove" : "favorite.add"} values={{ professionalId }} label={favorite ? "Retirer de mes favoris" : "Ajouter à mes favoris"} className="secondary"><Heart size={19}/></WorkspaceForm>{unassigned.length > 0 && <><h2><Link2 size={18}/> Transmettre une demande existante</h2><WorkspaceForm action="request.assign" values={{ professionalId }} label="Transmettre à ce professionnel" success="Demande transmise. La conversation est disponible dans votre messagerie."><label>Votre demande<select name="requestId" required>{unassigned.map((r) => <option key={r.id} value={r.id}>#{r.id} · {r.title}</option>)}</select></label></WorkspaceForm></>}</section>;
}
