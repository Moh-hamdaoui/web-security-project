"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";

const STATUS_COLORS = {
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  closed: "bg-gray-100 text-gray-600",
  resolved: "bg-green-100 text-green-700",
};

const PRIORITY_COLORS = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

export default function DashboardPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Auth check via localStorage user (non-sensible) — le cookie httpOnly gère l'auth réelle
    if (!localStorage.getItem("user")) { router.push("/login"); return; }

    fetch("/api/tickets")
      .then((r) => r.json())
      .then((data) => {
        setTickets(data.tickets || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mes tickets</h1>
          </div>
          <Link
            href="/tickets/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + Nouveau ticket
          </Link>
        </div>

        {loading ? (
          <p className="text-gray-500">Chargement...</p>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <Link key={ticket.id} href={`/tickets/${ticket.id}`} className="block">
                <div className="ticket-card">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-400 font-mono">#{ticket.id}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[ticket.status] || "bg-gray-100 text-gray-600"}`}>
                          {ticket.status}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[ticket.priority] || "bg-gray-100 text-gray-600"}`}>
                          {ticket.priority}
                        </span>
                      </div>
                      <h3 className="font-medium text-gray-900">{ticket.title}</h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{ticket.description}</p>
                    </div>
                    <div className="text-right text-xs text-gray-400 ml-4 shrink-0">
                      <div>{ticket.author_name}</div>
                      <div>{new Date(ticket.created_at).toLocaleDateString("fr-FR")}</div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
            {tickets.length === 0 && (
              <p className="text-gray-500 text-center py-12">Aucun ticket pour l'instant.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
