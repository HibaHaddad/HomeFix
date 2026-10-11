import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";
import LogoutButton from "@/components/LogoutButton";
 
export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true, email: true, createdAt: true },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <section className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-col justify-between gap-4 rounded-lg bg-white p-6 shadow-sm sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-bold text-blue-700">HomeFix</p>
            <h1 className="mt-1 text-3xl font-bold">Bonjour {user.name} !</h1>
            <p className="mt-2 text-slate-600">{user.email}</p>
          </div>
          <LogoutButton />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">Statut</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">Actif</p>
          </div>
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">Demandes</p>
            <p className="mt-2 text-2xl font-bold">0</p>
          </div>
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              Membre depuis
            </p>
            <p className="mt-2 text-2xl font-bold">
              {user.createdAt.toLocaleDateString("fr-FR")}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
