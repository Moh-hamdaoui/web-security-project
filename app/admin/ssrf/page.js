"use client";
// ⚠️  VULN: SSRF — interface pour tester l'endpoint /api/admin/fetch-url
// Payloads à tester :
//   http://169.254.169.254/latest/meta-data/          (AWS metadata)
//   http://169.254.169.254/latest/meta-data/iam/      (AWS IAM credentials)
//   http://localhost:3000/api/admin/users              (accès interne)
//   http://192.168.1.1                                 (scan réseau local)

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

const EXAMPLE_PAYLOADS = [
  { label: "AWS Metadata", url: "http://169.254.169.254/latest/meta-data/" },
  { label: "AWS IAM token", url: "http://169.254.169.254/latest/meta-data/iam/security-credentials/" },
  { label: "Accès interne (tickets)", url: "http://localhost:3000/api/tickets" },
  { label: "Accès interne (users)", url: "http://localhost:3000/api/admin/users" },
  { label: "Réseau local routeur", url: "http://192.168.1.1" },
];

export default function SSRFPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchUrl(e) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError("");

    const token = localStorage.getItem("token");
    const res = await fetch("/api/admin/fetch-url", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ url }),
    });

    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error); return; }
    setResult(data);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Test Webhook (SSRF)</h1>
        <p className="text-sm text-red-500 mb-6">
          ⚠️ Cet endpoint effectue une requête HTTP vers l'URL fournie depuis le serveur, sans validation.
        </p>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-red-800 mb-2">Payloads de démonstration</h3>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PAYLOADS.map((p) => (
              <button
                key={p.url}
                onClick={() => setUrl(p.url)}
                className="text-xs bg-white border border-red-300 text-red-700 px-3 py-1.5 rounded hover:bg-red-100"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <form onSubmit={fetchUrl} className="flex gap-3 mb-6">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com ou http://169.254.169.254/..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none font-mono"
            />
            <button
              type="submit"
              disabled={loading || !url}
              className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? "Fetch..." : "Envoyer"}
            </button>
          </form>

          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

          {result && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className={`text-sm font-medium px-2 py-0.5 rounded ${result.status < 300 ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                  HTTP {result.status}
                </span>
                <span className="text-xs text-gray-400">Réponse du serveur distant reçue côté serveur Next.js</span>
              </div>
              <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-lg overflow-auto max-h-96">
                {typeof result.body === "object"
                  ? JSON.stringify(result.body, null, 2)
                  : result.body}
              </pre>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
