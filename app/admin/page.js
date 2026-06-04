"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function AdminPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({ open: 0, in_progress: 0, closed: 0 });

  useEffect(() => {
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    // ⚠️  Vérification côté client uniquement — contournable
    if (!token || user.role !== "admin") {
      router.push("/dashboard");
      return;
    }

    fetch("/api/tickets", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        const t = data.tickets || [];
        setTickets(t);
        setStats({
          open: t.filter((x) => x.status === "open").length,
          in_progress: t.filter((x) => x.status === "in_progress").length,
          closed: t.filter((x) => x.status === "closed" || x.status === "resolved").length,
        });
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Tableau de bord Admin</h1>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <div className="text-3xl font-bold text-blue-600">{stats.open}</div>
            <div className="text-sm text-gray-500 mt-1">Ouverts</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <div className="text-3xl font-bold text-yellow-500">{stats.in_progress}</div>
            <div className="text-sm text-gray-500 mt-1">En cours</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <div className="text-3xl font-bold text-green-600">{stats.closed}</div>
            <div className="text-sm text-gray-500 mt-1">Résolus</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <Link href="/admin/users" className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition">
            <div className="font-semibold text-gray-900">Gestion des utilisateurs</div>
            <div className="text-sm text-gray-500 mt-1">Voir tous les comptes + mots de passe en clair ⚠️</div>
          </Link>
          <Link href="/admin/ssrf" className="bg-white rounded-xl border border-red-200 p-5 hover:shadow-md transition">
            <div className="font-semibold text-red-700">Test Webhook (SSRF)</div>
            <div className="text-sm text-gray-500 mt-1">Fetch une URL arbitraire depuis le serveur ⚠️</div>
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Tous les tickets</h2>
          <div className="space-y-2">
            {tickets.map((t) => (
              <Link key={t.id} href={`/tickets/${t.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-gray-100">
                <div>
                  <span className="text-xs font-mono text-gray-400 mr-2">#{t.id}</span>
                  <span className="text-sm font-medium text-gray-900">{t.title}</span>
                  <span className="text-xs text-gray-400 ml-2">par {t.author_name}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === "open" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                  {t.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
