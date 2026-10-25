"use client";

import { useMemo, useState } from "react";
import ProfessionalIcon from "@/components/professional/ProfessionalIcon";

function tunisDate() {
  const parts = new Intl.DateTimeFormat("fr-CA", { timeZone: "Africa/Tunis", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "01";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function fromDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function ProfessionalCalendar() {
  const [todayKey] = useState(tunisDate);
  const [month, setMonth] = useState(() => fromDateKey(todayKey));
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const cells = useMemo(() => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const offset = (new Date(year, monthIndex, 1, 12).getDay() + 6) % 7;
    const totalDays = new Date(year, monthIndex + 1, 0, 12).getDate();
    return Array.from({ length: 42 }, (_, index) => {
      const day = index - offset + 1;
      return day > 0 && day <= totalDays ? day : null;
    });
  }, [month]);

  function moveMonth(amount: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1, 12));
    setSelectedDay("");
  }

  const selectedDate = selectedDay ? fromDateKey(selectedDay) : null;
  const monthLabel = month.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return <section className="pro-calendar-layout" aria-label="Calendrier des réservations">
    <div className="pro-panel pro-calendar-panel">
      <div className="pro-calendar-toolbar"><div><span className="pro-calendar-eyebrow">VOTRE AGENDA</span><h2>{monthLabel}</h2></div><div className="pro-calendar-controls"><button type="button" aria-label="Mois précédent" onClick={() => moveMonth(-1)}><ProfessionalIcon name="chevron-left" size={17}/></button><button type="button" aria-label="Revenir au mois actuel" onClick={() => { const date = fromDateKey(todayKey); setMonth(date); setSelectedDay(todayKey); }}>Aujourd’hui</button><button type="button" aria-label="Mois suivant" onClick={() => moveMonth(1)}><ProfessionalIcon name="chevron-right" size={17}/></button></div></div>
      <div className="pro-calendar-grid" role="grid" aria-label={`Calendrier de ${monthLabel}`}>
        {["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."].map((weekday) => <div className="pro-calendar-weekday" role="columnheader" key={weekday}>{weekday}</div>)}
        {cells.map((day, index) => {
          if (!day) return <span className="pro-calendar-day is-outside" role="gridcell" aria-hidden="true" key={`outside-${index}`} />;
          const dateKey = toDateKey(new Date(month.getFullYear(), month.getMonth(), day, 12));
          const isToday = dateKey === todayKey;
          const isSelected = dateKey === selectedDay;
          return <div className="pro-calendar-cell" role="gridcell" key={dateKey}><button type="button" className={`pro-calendar-day${isToday ? " is-today" : ""}${isSelected ? " is-selected" : ""}`} aria-label={new Date(month.getFullYear(), month.getMonth(), day, 12).toLocaleDateString("fr-FR", { dateStyle: "full" })} aria-pressed={isSelected} onClick={() => setSelectedDay(dateKey)}>{day}</button></div>;
        })}
      </div>
      <div className="pro-calendar-legend"><span><i/>Aujourd’hui</span><span><b/>Jour sélectionné</span></div>
    </div>
    <aside className="pro-panel pro-calendar-day-panel"><div className="pro-calendar-day-date"><span className="pro-calendar-day-icon"><ProfessionalIcon name="calendar" size={19}/></span><div><small>JOUR SÉLECTIONNÉ</small><h3>{selectedDate ? selectedDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "Choisissez une date"}</h3></div></div><div className="pro-calendar-no-data"><span><ProfessionalIcon name="inbox" size={20}/></span><strong>Aucun rendez-vous à afficher</strong><p>Les réservations apparaîtront ici dès qu’elles seront disponibles sur HomeFix.</p></div><p className="pro-calendar-note">Les rendez-vous ne sont pas encore reliés à votre agenda.</p></aside>
  </section>;
}
