"use client";
import InterventionComposer from "./InterventionComposer";
export default function ProfessionalContact({ professionalId, address }: { professionalId: number; address: string }) {
  return <section id="contact" className="client-contact-form"><span className="eyebrow">VOTRE DEMANDE D’INTERVENTION</span><h2>Choisissez votre créneau.</h2><p>Sélectionnez une disponibilité du professionnel, décrivez votre problème et indiquez votre adresse. Le rendez-vous sera confirmé après accord sur le créneau et le devis.</p><InterventionComposer professionalId={professionalId} address={address} inline/></section>;
}
