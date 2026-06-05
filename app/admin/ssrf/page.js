"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

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

    const res = await fetch("/api/admin/fetch-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Test Webhook</h1>
        <p className="text-sm text-gray-500 mb-6">
          Testez la connectivité vers vos endpoints webhook. Seuls les domaines autorisés sont acceptés.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-800">
          <strong>Domaines autorisés :</strong> hooks.slack.com, discord.com, api.github.com, hooks.zapier.com
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <form onSubmit={fetchUrl} className="flex gap-3 mb-6">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
            />
            <button
              type="submit"
              disabled={loading || !url}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Test..." : "Tester"}
            </button>
          </form>

          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

          {result && (
            <div className={`p-4 rounded-lg ${result.ok ? "bg-green-50 text-green-800 border border-green-200" : "bg-orange-50 text-orange-800 border border-orange-200"}`}>
              <span className="font-medium">HTTP {result.status}</span> — {result.message}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
