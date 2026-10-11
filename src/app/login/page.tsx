import Link from "next/link";
import AuthForm from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
      <section className="w-full max-w-md rounded-lg bg-white p-8 shadow-sm">
        <div className="mb-6 space-y-2">
          <Link href="/" className="text-sm font-bold text-blue-700">
            HomeFix
          </Link>
          <h1 className="text-3xl font-bold">Connexion</h1>
          <p className="text-slate-600">
            Connectez-vous pour acceder a votre espace.
          </p>
        </div>
        <AuthForm mode="login" />
        <p className="mt-5 text-sm text-slate-600">
          Pas encore de compte ?{" "}
          <Link className="font-bold text-blue-700" href="/register">
            Creer un compte
          </Link>
        </p>
      </section>
    </main>
  );
}
