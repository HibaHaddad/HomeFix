"use client";
import InterventionComposer from "./InterventionComposer";
export default function ProfessionalContact({ professionalId, address }: { professionalId: number; address: string }) {
  return <section id="contact" className="client-contact-form"><span className="eyebrow">LES DISPONIBILITÉS DU PROFESSIONNEL</span><h2>Choisissez votre créneau.</h2><p>Seuls les créneaux publiés et encore libres sont proposés. Le rendez-vous sera confirmé après acceptation du professionnel et du devis.</p><InterventionComposer professionalId={professionalId} address={address} inline/></section>;
}
