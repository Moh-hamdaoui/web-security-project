import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">TicketApp</h1>
        <p className="text-gray-500 text-lg">Système de gestion de tickets support</p>
        <div className="mt-2 inline-block bg-red-100 text-red-700 text-xs px-3 py-1 rounded-full font-mono">
          ⚠️ Version intentionnellement vulnérable — usage pédagogique uniquement
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

      <div className="mt-8 max-w-lg w-full bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h2 className="font-semibold text-yellow-800 mb-2">Comptes de test</h2>
        <div className="space-y-1 text-sm font-mono text-yellow-900">
          <div>admin@tickets.local / admin123 (role: admin)</div>
          <div>alice@example.com / alice123 (role: user)</div>
          <div>bob@example.com / bob123 (role: user)</div>
        </div>
      </div>
    </main>
  );
}
