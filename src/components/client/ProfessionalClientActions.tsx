"use client";
import { Heart } from "lucide-react";
import WorkspaceForm from "./WorkspaceForm";
import ContactButton from "./ContactButton";
export default function ProfessionalClientActions({ professionalId, favorite }: { professionalId: number; favorite: boolean }) {
  return <section className="client-panel"><ContactButton professionalId={professionalId}/><WorkspaceForm action={favorite ? "favorite.remove" : "favorite.add"} values={{ professionalId }} label={favorite ? "Retirer de mes favoris" : "Ajouter à mes favoris"} className="secondary"><Heart size={19}/></WorkspaceForm></section>;
}
