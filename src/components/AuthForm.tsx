"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthForm({
  mode,
}: {
  mode: "login" | "register";
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const data = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    setLoading(false);

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Une erreur est survenue");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  const cta = mode === "login" ? "Se connecter" : "S'inscrire";

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-3">
      {mode === "register" && (
        <input
          name="name"
          placeholder="Nom"
          required
          className="input"
        />
      )}

      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        className="input"
      />

      <input
        name="password"
        type="password"
        placeholder="Mot de passe"
        required
        className="input"
      />

      {error && <p className="text-red-500">{error}</p>}

      <button
        disabled={loading}
        className="btn btn-primary mt-2 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? "..." : cta}
      </button>
    </form>
  );
}
