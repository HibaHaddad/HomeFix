import { AlarmClock, BadgeCheck, BellRing, CalendarCheck2, CalendarX2, CircleCheck, CircleX, MessageSquareText, Paperclip, ReceiptText, Send, ShieldCheck, Star, Truck, Wrench } from "lucide-react";

const presentations = {
  MESSAGE: { label: "Message", icon: MessageSquareText, tone: "sage" },
  ATTACHMENT: { label: "Pièce jointe", icon: Paperclip, tone: "blue" },
  REQUEST_SENT: { label: "Demande", icon: Send, tone: "sage" },
  PRICE_PROPOSED: { label: "Prix proposé", icon: ReceiptText, tone: "gold" },
  PRICE_ACCEPTED: { label: "Prix confirmé", icon: BadgeCheck, tone: "sage" },
  BOOKING_CONFIRMED: { label: "Rendez-vous", icon: CalendarCheck2, tone: "blue" },
  BOOKING_CANCELLED: { label: "Annulation", icon: CalendarX2, tone: "rose" },
  BOOKING_REJECTED: { label: "Demande refusée", icon: CircleX, tone: "rose" },
  PRO_ON_THE_WAY: { label: "En route", icon: Truck, tone: "blue" },
  INTERVENTION_STARTED: { label: "Intervention en cours", icon: Wrench, tone: "gold" },
  INTERVENTION_COMPLETED: { label: "Intervention terminée", icon: CircleCheck, tone: "sage" },
  INTERVENTION_VALIDATED: { label: "Fin validée", icon: ShieldCheck, tone: "sage" },
  PAYMENT_RECEIVED: { label: "Paiement confirmé", icon: ReceiptText, tone: "sage" },
  REVIEW_RECEIVED: { label: "Avis client", icon: Star, tone: "gold" },
  REMINDER: { label: "Entretien", icon: AlarmClock, tone: "gold" },
  INFO: { label: "Information", icon: BellRing, tone: "sage" },
};
export function notificationPresentation(type: string) { return presentations[type as keyof typeof presentations] || presentations.INFO; }
export default function NotificationIcon({ type, className = "" }: { type: string; className?: string }) {
  const { icon: Icon, tone } = notificationPresentation(type);
  return <span className={`nx-icon tone-${tone} ${className}`} data-notification-type={type} aria-hidden="true"><Icon size={22} strokeWidth={1.6}/></span>;
}
