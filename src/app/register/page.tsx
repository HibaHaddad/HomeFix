import Link from "next/link";
import AuthForm from "@/components/AuthForm";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
      <section className="w-full max-w-md rounded-lg bg-white p-8 shadow-sm">
        <div className="mb-6 space-y-2">
          <Link href="/" className="text-sm font-bold text-blue-700">
            HomeFix
          </Link>
          <h1 className="text-3xl font-bold">Inscription</h1>
          <p className="text-slate-600">
            Creez votre compte pour commencer.
          </p>
        </div>
        <AuthForm mode="register" />
        <p className="mt-5 text-sm text-slate-600">
          Deja un compte ?{" "}
          <Link className="font-bold text-blue-700" href="/login">
            Se connecter
          </Link>
        </p>
      </section>
    </main>
  );
}
