"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { createUserProfile } from "@/lib/supabase/actions";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { error: profileError } = await createUserProfile(
        data.user.id,
        data.user.email!
      );
      if (profileError) {
        setError(`Account created but profile setup failed: ${profileError}`);
        setLoading(false);
        return;
      }

      // If email confirmation is disabled, a session is returned immediately
      if (data.session) {
        router.push("/");
        router.refresh();
        return;
      }
    }

    setLoading(false);
    setConfirmed(true);
  }

  if (confirmed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <span className="text-3xl font-bold tracking-tight text-[#1D5C3A]">Briefd</span>
          <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="text-4xl mb-4">📬</div>
            <h1 className="text-xl font-semibold text-gray-900 mb-3">Check your email</h1>
            <p className="text-sm text-gray-500">
              We sent a confirmation link to <strong className="text-gray-800">{email}</strong>.
              Click the link to activate your account, then{" "}
              <Link href="/login" className="text-[#1D5C3A] font-medium hover:underline">
                sign in
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <span className="text-3xl font-bold tracking-tight text-[#1D5C3A]">Briefd</span>
          <p className="mt-2 text-sm text-gray-500">Your personalised news digest</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-6">Create account</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-[#1D5C3A] focus:ring-2 focus:ring-[#1D5C3A]/10"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-[#1D5C3A] focus:ring-2 focus:ring-[#1D5C3A]/10"
                placeholder="Min. 8 characters"
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-[#1D5C3A] focus:ring-2 focus:ring-[#1D5C3A]/10"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#1D5C3A] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#174d31] focus:outline-none focus:ring-2 focus:ring-[#1D5C3A]/50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[#1D5C3A] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
