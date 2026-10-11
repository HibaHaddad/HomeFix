import Link from "next/link";

const services = ["Plomberie", "Electricite", "Peinture", "Menuiserie"];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-6">
        <nav className="flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-wide">
            HomeFix
          </Link>
          <div className="flex items-center gap-3">
            <Link className="nav-link" href="/login">
              Connexion
            </Link>
            <Link className="btn btn-light" href="/register">
              Creer un compte
            </Link>
          </div>
        </nav>

        <div className="grid flex-1 items-center gap-10 py-14 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="max-w-2xl space-y-8">
            <p className="badge">Services maison rapides et fiables</p>
            <div className="space-y-5">
              <h1 className="text-4xl font-bold leading-tight sm:text-6xl">
                Trouvez un professionnel pour vos reparations a domicile.
              </h1>
              <p className="max-w-xl text-lg leading-8 text-slate-300">
                HomeFix vous aide a gerer vos demandes, suivre votre compte et
                centraliser vos services depuis une interface simple.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link className="btn btn-primary" href="/register">
                Commencer
              </Link>
              <Link className="btn btn-outline" href="/login">
                J'ai deja un compte
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white p-5 text-slate-950 shadow-2xl">
            <div className="mb-5 flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <p className="text-sm font-medium text-slate-500">Apercu</p>
                <h2 className="text-2xl font-bold">Demandes recentes</h2>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                Actif
              </span>
            </div>

            <div className="space-y-3">
              {services.map((service, index) => (
                <div
                  className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 p-4"
                  key={service}
                >
                  <div>
                    <p className="font-semibold">{service}</p>
                    <p className="text-sm text-slate-500">
                      Intervention #{index + 1}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-blue-700">
                    En attente
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
