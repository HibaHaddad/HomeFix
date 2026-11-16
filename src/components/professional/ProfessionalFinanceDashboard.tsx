"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarDays, CheckCheck, ChevronDown, Clock3, ReceiptText, RefreshCw, ShieldCheck, TriangleAlert, Wallet } from "lucide-react";
import { dateLabel } from "@/lib/client-domain";
import { financeMoney, type FinancePeriod, type FinanceTransaction, type ProfessionalFinance } from "@/lib/professional-finance";
import { getChatSocket } from "@/lib/chat-socket";
import styles from "./ProfessionalPayments.module.css";
import { commissionLabel } from "@/lib/payment-allocation";

type Filter = "all" | FinanceTransaction["kind"];
const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "Tous" }, { key: "gain", label: "Gains" },
  { key: "sanction", label: "Sanctions" }, { key: "pending", label: "En attente" },
];
const periods: { key: FinancePeriod; label: string }[] = [
  { key: "all", label: "Toute la période" }, { key: "month", label: "Ce mois-ci" },
  { key: "30days", label: "30 derniers jours" }, { key: "90days", label: "90 derniers jours" }, { key: "year", label: "Cette année" },
];

export default function ProfessionalFinanceDashboard({ finance, period, updatedAt }: { finance: ProfessionalFinance; period: FinancePeriod; updatedAt: string }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [visible, setVisible] = useState(12);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout>;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(debounce);
      debounce = setTimeout(() => startTransition(() => router.refresh()), 400);
    };
    const socket = getChatSocket();
    socket.on("intervention:updated", refresh);
    socket.on("connect", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = setInterval(refresh, 30000);
    return () => {
      clearTimeout(debounce);
      clearInterval(timer);
      socket.off("intervention:updated", refresh);
      socket.off("connect", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);

  const rows = finance.transactions.filter((row) => filter === "all" || row.kind === filter);
  const count = (key: Filter) => key === "all" ? finance.transactions.length : finance.transactions.filter((row) => row.kind === key).length;
  const selectPeriod = (value: string) => {
    const url = new URL(window.location.href);
    if (value === "all") url.searchParams.delete("periode"); else url.searchParams.set("periode", value);
    setVisible(12);
    startTransition(() => router.push(`${url.pathname}${url.search}`, { scroll: false }));
  };
  const summary = [
    { label: "Gains bruts", value: finance.earnedMillimes, note: "Montants initiaux des paiements confirmés", style: styles.gain, icon: ArrowDownLeft },
    { label: "Commissions déduites", value: finance.commissionsMillimes, note: "Après annulation des commissions remboursées", style: styles.sanction, icon: ShieldCheck },
    { label: "Sanctions financières", value: finance.sanctionsMillimes, note: "Décisions Admin actives, hors commissions", style: styles.sanction, icon: TriangleAlert },
    { label: "Revenu net", value: finance.netMillimes, note: `Après commissions, sanctions et ${financeMoney(finance.refundedMillimes)} de remboursements`, style: styles.net, icon: Wallet },
    { label: "Paiements en attente", value: finance.pendingMillimes, note: "Solde des factures à régler", style: styles.pending, icon: Clock3 },
  ];

  return <>
    <header className={styles.heading}>
      <div><div className={styles.eyebrow}><span /> VOTRE ACTIVITÉ FINANCIÈRE</div><h1>Paiements <span>& revenus</span></h1><p>Chaque intervention compte. Gardez le fil de vos revenus.</p></div>
      <button type="button" className={styles.refresh} onClick={() => startTransition(() => router.refresh())} disabled={isPending}><RefreshCw size={15} className={isPending ? styles.spinning : ""} /><span>{isPending ? "Actualisation…" : "Actualiser"}</span></button>
    </header>

    <div className={styles.balance}><div><Wallet size={22}/><div><strong>Solde comptable</strong><p>Cumul de vos revenus nets · simulation sans transfert bancaire</p></div></div><strong>{financeMoney(finance.balanceMillimes)}</strong></div>
    <section className={styles.overview} aria-label="Résumé financier" aria-busy={isPending}>
      <div className={styles.overviewLabel}><span>VUE D’ENSEMBLE</span></div>
      <div className={styles.summary}>{summary.map((item) => <article key={item.label} className={`${styles.metric} ${item.style}`}>
        <div className={styles.metricTop}><span>{item.label}</span><span className={styles.metricIcon}><item.icon size={19} /></span></div>
        <strong className={styles.amount}>{financeMoney(item.value)}</strong><small>{item.note}</small>
      </article>)}</div>
    </section>

    <section className={styles.history} aria-labelledby="finance-history">
      <div className={styles.historyHeading}><div><span className={styles.eyebrow}>LE DÉTAIL DE VOTRE ACTIVITÉ</span><h2 id="finance-history">Historique des transactions <span>{finance.transactions.length}</span></h2></div><div className={styles.period}><CalendarDays size={16} /><label className={styles.srOnly} htmlFor="finance-period">Filtrer par période</label><select id="finance-period" value={period} onChange={(event) => selectPeriod(event.target.value)} disabled={isPending}>{periods.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select><ChevronDown size={13} /></div></div>
      <div className={styles.filterBar}><div className={styles.filters} role="group" aria-label="Type de transaction">{filters.map((item) => <button key={item.key} type="button" aria-pressed={filter === item.key} className={filter === item.key ? styles.activeFilter : ""} onClick={() => { setFilter(item.key); setVisible(12); }}>{item.label}<span>{count(item.key)}</span></button>)}</div></div>
      <p className={styles.periodNote}></p>

      <div aria-busy={isPending} className={styles.transactions}>
        {rows.slice(0, visible).map((row) => <TransactionCard key={row.id} row={row} />)}
      </div>
      {!rows.length && <div className={styles.empty}><span>{filter === "sanction" ? <ShieldCheck size={25} /> : <ReceiptText size={25} />}</span><h3>{filter === "sanction" ? "Aucune sanction" : filter === "gain" ? "Aucun gain sur cette période" : filter === "pending" ? "Aucun paiement en attente" : "Aucune transaction sur cette période"}</h3>{filter !== "sanction" && <p>Les paiements liés à vos interventions apparaîtront ici dès leur enregistrement.</p>}{period !== "all" && <button type="button" className={styles.emptyAction} disabled={isPending} onClick={() => selectPeriod("all")}>Voir toute la période <ArrowRight size={14} /></button>}</div>}
      {rows.length > visible && <button className={styles.loadMore} type="button" onClick={() => setVisible((value) => value + 12)}>Afficher plus de transactions <ChevronDown size={15} /></button>}
      <footer className={styles.footer}><span><CheckCheck size={14} />Montants en dinars tunisiens (DT)</span><span>Dernière lecture : {dateLabel(updatedAt)}</span></footer>
    </section>
  </>;
}

function TransactionCard({ row }: { row: FinanceTransaction }) {
  const gain = row.kind === "gain", sanction = row.kind === "sanction";
  const Icon = gain ? ArrowDownLeft : sanction ? TriangleAlert : Clock3;
  const status = gain ? row.refundedMillimes && row.refundedMillimes === row.grossMillimes ? "Remboursé" : row.refundedMillimes ? "Partiellement remboursé" : "Payé" : sanction ? "Sanction" : "En attente";
  return <article className={`${styles.transaction} ${gain ? styles.gain : sanction ? styles.sanction : styles.pending}`}>
    <div className={styles.transactionTop}><span className={styles.transactionIcon}><Icon size={21} /></span><div className={styles.transactionLabel}><span>{gain ? "PAIEMENT REÇU" : sanction ? "SANCTION ET PÉNALITÉ" : "PAIEMENT À RECEVOIR"}</span><time dateTime={row.date}>{dateLabel(row.date)}</time></div><span className={styles.badge}>{status}</span></div>
    <div className={styles.transactionBody}><div><h3>{row.title}</h3><p>{sanction ? row.reason : row.client}</p></div><strong className={styles.transactionAmount}>{gain ? "+" : sanction ? "−" : ""}{financeMoney(row.amountMillimes)}</strong></div>
    {gain && <dl className={styles.allocation}><div><dt>Montant initial</dt><dd>{financeMoney(row.grossMillimes ?? row.amountMillimes)}</dd></div><div><dt>Commission · {commissionLabel(row.commissionBps ?? 0)}</dt><dd>−{financeMoney(row.commissionMillimes ?? 0)}</dd></div>{!!row.refundedMillimes && <><div><dt>Montant remboursé au client</dt><dd>{financeMoney(row.refundedMillimes)}</dd></div><div><dt>Commission annulée</dt><dd>+{financeMoney(row.refundedCommissionMillimes ?? 0)}</dd></div></>}<div><dt>Revenu net reçu</dt><dd>{financeMoney(row.amountMillimes)}</dd></div></dl>}
    <div className={styles.cardActions}><Link href={`/professionnel/interventions?demande=${row.requestId}#intervention-${row.requestId}`}>Intervention<ArrowUpRight size={14} /></Link>{row.receiptUrl && <a href={row.receiptUrl} target="_blank" rel="noopener noreferrer"><ReceiptText size={14} />Reçu détaillé</a>}{row.historical && <small>Paiement antérieur · sans commission rétroactive</small>}</div>
  </article>;
}
