"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

export default function LoginPage() {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });

      if (!res.ok) {
        setError("Invalid passphrase");
        setLoading(false);
        return;
      }

      const data = await res.json();
      localStorage.setItem("af_token", data.token);
      router.push("/");
    } catch {
      setError("Cannot connect to API server");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="bg-[#1a1a1a] border border-[#262626] rounded-lg p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-white mb-1">ZeroClaw App Factory</h1>
        <p className="text-[#a3a3a3] text-sm mb-6">Local dashboard access</p>

        <form onSubmit={handleLogin}>
          <input
            type="password"
            placeholder="Passphrase"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white text-sm mb-4 focus:outline-none focus:border-[#3b82f6]"
            autoFocus
          />

          {error && (
            <p className="text-red-400 text-xs mb-3">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !passphrase}
            className="w-full bg-[#3b82f6] hover:bg-[#2563eb] disabled:bg-[#333] text-white rounded px-3 py-2 text-sm font-medium transition-colors"
          >
            {loading ? "..." : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}
