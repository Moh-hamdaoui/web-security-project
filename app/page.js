import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">TicketApp</h1>
        <p className="text-gray-500 text-lg">Système de gestion de tickets support</p>
        <div className="mt-2 inline-block bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full font-mono">
          ✓ Version sécurisée
        </div>
      </div>

      <div className="flex gap-4 mt-4">
        <Link
          href="/login"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
        >
          Se connecter
        </Link>
        <Link
          href="/register"
          className="px-6 py-3 bg-white text-blue-600 border border-blue-600 rounded-lg font-medium hover:bg-blue-50 transition"
        >
          Créer un compte
        </Link>
      </div>

    </main>
  );
}
