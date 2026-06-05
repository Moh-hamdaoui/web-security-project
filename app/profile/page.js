"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function ProfilePage() {
  const router = useRouter();
  const [form, setForm]       = useState({ username: "", email: "" });
  const [message, setMessage] = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId]   = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) { router.push("/login"); return; }

    const u = JSON.parse(stored);
    setUserId(u.id);

    fetch(`/api/users/${u.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setForm({ username: data.user.username || "", email: data.user.email || "" });
        }
        setLoading(false);
      });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");
    setError("");

    // FIX VLN-06: seuls username et email sont envoyés — jamais le champ "role"
    const res = await fetch(`/api/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.username, email: form.email }),
    });

    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }

    const current = JSON.parse(localStorage.getItem("user") || "{}");
    localStorage.setItem("user", JSON.stringify({ ...current, ...data.user }));
    setMessage("Profil mis à jour");
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50"><Navbar />
      <p className="p-8 text-gray-500">Chargement...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Mon profil</h1>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom d'utilisateur
              </label>
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {error   && <p className="text-sm text-red-600 bg-red-50 p-3 rounded">{error}</p>}
            {message && <p className="text-sm text-green-700 bg-green-50 p-3 rounded">{message}</p>}

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700"
            >
              Mettre à jour
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
