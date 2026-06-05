"use client";
// ⚠️  VULN: Mass Assignment visible sur cette page
// Le formulaire envoie tous les champs y compris "role"
// Un utilisateur peut changer son rôle en "admin" via les DevTools

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function ProfilePage() {
  const router = useRouter();
  const [form, setForm]     = useState({ username: "", email: "", password: "", role: "" });
  const [message, setMessage] = useState("");
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const stored = localStorage.getItem("user");
    if (!token) { router.push("/login"); return; }

    const u = stored ? JSON.parse(stored) : null;
    if (!u) { router.push("/login"); return; }
    setUserId(u.id);

    fetch(`/api/users/${u.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setForm({
            username: data.user.username || "",
            email:    data.user.email    || "",
            password: "",
            role:     data.user.role     || "user",
          });
        }
        setLoading(false);
      });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");
    setError("");

    const token = localStorage.getItem("token");
    const body = { username: form.username, email: form.email };
    if (form.password) body.password = form.password;
    // ⚠️  Le champ "role" est inclus dans le body — mass assignment possible
    body.role = form.role;

    const res = await fetch(`/api/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }

    // Mise à jour du localStorage avec le nouveau rôle
    const current = JSON.parse(localStorage.getItem("user") || "{}");
    localStorage.setItem("user", JSON.stringify({ ...current, ...data.user }));
    setMessage(`Profil mis à jour. Rôle actuel : ${data.user.role}`);

    // Rechargement pour mettre à jour la navbar
    window.location.reload();
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
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Mon profil</h1>

        {/* ⚠️  Bannière pédagogique */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-800">
          <strong>⚠️ VLN-06 Mass Assignment :</strong> Le champ <code>role</code> est envoyé
          sans contrôle. Changez-le en <code>admin</code> pour vous auto-promouvoir.
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom d'utilisateur</label>
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Laisser vide pour ne pas changer"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* ⚠️  Champ role — visible et modifiable intentionnellement */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rôle <span className="text-red-500 text-xs">(⚠️ non protégé — mass assignment)</span>
              </label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none bg-red-50"
              >
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
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
