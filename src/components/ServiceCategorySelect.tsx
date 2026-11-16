"use client";
import { useEffect, useState } from "react";
import type { PublicServiceCategory } from "@/lib/service-categories";

export default function ServiceCategorySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [categories, setCategories] = useState<PublicServiceCategory[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/categories", { signal: controller.signal, cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(data => setCategories(data.categories))
      .catch(error => { if (error.name !== "AbortError") setError(true); });
    return () => controller.abort();
  }, []);
  return <><select required value={value} onChange={event => onChange(event.target.value)}>
    <option value="" disabled>Choisir une catégorie</option>
    {value && !categories.some(category => category.name === value) && <option value={value}>{value} · Catégorie actuelle</option>}
    {categories.map(category => <option key={category.id} value={category.name}>{category.name}</option>)}
  </select>{error && <small role="alert">Le catalogue est indisponible. Votre spécialité actuelle reste conservée.</small>}</>;
}
