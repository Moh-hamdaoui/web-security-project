"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="font-bold text-blue-600 text-lg">TicketApp</Link>
        <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Mes tickets</Link>
        <Link href="/profile" className="text-sm text-gray-600 hover:text-gray-900">Mon profil</Link>
        {user?.role === "admin" && (
          <>
            <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900">Admin</Link>
            <Link href="/admin/users" className="text-sm text-gray-600 hover:text-gray-900">Utilisateurs</Link>
            <Link href="/admin/ssrf" className="text-sm text-gray-600 hover:text-gray-900">Webhooks</Link>
          </>
        )}
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <span className="text-sm text-gray-600">
            {user.username}
            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${user.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
              {user.role}
            </span>
          </span>
        )}
        <button onClick={logout} className="text-sm text-gray-500 hover:text-red-600">Déconnexion</button>
      </div>
    </nav>
  );
}
