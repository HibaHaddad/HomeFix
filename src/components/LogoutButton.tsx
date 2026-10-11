"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-700"
    >
      Se deconnecter
    </button>
  );
}
