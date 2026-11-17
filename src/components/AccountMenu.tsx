"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import LogoutButton from "./LogoutButton";
import styles from "./AccountMenu.module.css";

export default function AccountMenu({ name, role, avatar }: { name: string; role: "Client" | "Professionnel"; avatar: ReactNode }) {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !menu.current?.contains(event.target) && menu.current) menu.current.open = false;
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  return <details className={styles.root} ref={menu}>
    <summary className={styles.trigger} aria-label={`Menu du compte ${role.toLowerCase()}`}>
      {avatar}<span className={styles.copy}><strong>{name}</strong><small>{role}</small></span><ChevronDown size={16} className={styles.chevron} aria-hidden="true"/>
    </summary>
    <div className={styles.dropdown}>
      <div className={styles.identity}>{avatar}<span className={styles.copy}><strong>{name}</strong><small>{role}</small></span></div>
      <div className={styles.divider}/>
      <div className={styles.logout}><LogoutButton/></div>
    </div>
  </details>;
}
