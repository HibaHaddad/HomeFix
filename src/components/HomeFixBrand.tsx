import Link from "next/link";
import styles from "./HomeFixBrand.module.css";

export function HomeFixMark() {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 13l-3-3 3.7-3.7Z" /></svg>;
}

/** The home page wordmark and symbol, shared by every application surface. */
export default function HomeFixBrand({ subtitle, inverse = false, className = "" }: { subtitle?: string; inverse?: boolean; className?: string }) {
  return <Link href="/" aria-label="HomeFix, accueil" data-homefix-brand className={`${styles.brand} ${inverse ? styles.inverse : ""} ${className}`}>
    <span className={styles.mark} data-brand-mark><HomeFixMark/></span>
    <span className={styles.copy} data-brand-copy><span className={styles.name}>homefix</span>{subtitle && <small className={styles.subtitle}>{subtitle}</small>}</span>
  </Link>;
}
