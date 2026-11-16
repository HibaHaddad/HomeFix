"use client";

import { useEffect, useRef, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export default function AdminAutoFiltersForm({ action, className, children }: { action: string; className: string; children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelSearch() {
    if (searchTimer.current !== null) clearTimeout(searchTimer.current);
    searchTimer.current = null;
  }

  useEffect(() => {
    // Keep the controls in sync when navigating back through filtered results.
    function restoreFilters() {
      cancelSearch();
      const params = new URLSearchParams(window.location.search);
      for (const control of Array.from(formRef.current?.elements ?? [])) {
        if (control instanceof HTMLInputElement) {
          control.value = params.get(control.name) ?? "";
        } else if (control instanceof HTMLSelectElement) {
          const value = params.get(control.name) ?? control.options[0]?.value ?? "";
          control.value = Array.from(control.options).some(option => option.value === value) ? value : value.toUpperCase();
        }
      }
    }
    window.addEventListener("popstate", restoreFilters);
    return () => { cancelSearch(); window.removeEventListener("popstate", restoreFilters); };
  }, []);

  function applyFilters(form: HTMLFormElement) {
    cancelSearch();
    const params = new URLSearchParams();
    new FormData(form).forEach((value, name) => {
      if (typeof value === "string" && value.trim()) params.set(name, value.trim());
    });
    // A new selection always starts at the first page of matching results.
    startTransition(() => router.replace(`${action}?${params.toString()}`, { scroll: false }));
  }

  return <form ref={formRef} className={className} action={action} method="get" aria-busy={pending}
    onChange={event => {
      if (event.target instanceof HTMLSelectElement) applyFilters(event.currentTarget);
      else if (event.target instanceof HTMLInputElement && event.target.name === "q") {
        cancelSearch();
        const form = event.currentTarget;
        searchTimer.current = setTimeout(() => applyFilters(form), 350);
      }
    }}
    onSubmit={event => { event.preventDefault(); applyFilters(event.currentTarget); }}>
    {children}
    <span className="sr-only" role="status">{pending ? "Mise à jour des résultats…" : ""}</span>
  </form>;
}
