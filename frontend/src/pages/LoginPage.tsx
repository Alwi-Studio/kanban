import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../services/auth";
import { useAuthStore } from "../store/authStore";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await login(email, password);
      setUser(res.user);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-page dark:bg-bg-dark px-4">
      <form onSubmit={handleSubmit} className="card p-8 sm:p-10 w-full max-w-md shadow-xl">
        <div className="w-11 h-11 rounded-xl bg-brand flex items-center justify-center text-white font-bold mx-auto mb-5">A</div>
        <h1 className="text-2xl font-bold mb-1 text-center text-gray-900 dark:text-white">Welcome back</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-7">Sign in to continue to your workspace</p>
        {error && <p className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2.5 text-sm mb-4" role="alert">{error}</p>}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            autoComplete="email"
            required
          />
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            autoComplete="current-password"
            required
          />
        </div>
        <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5">
          {submitting ? "Signing in..." : "Sign In"}
        </button>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-5">
          Don't have an account? <Link to="/register" className="text-brand font-semibold hover:underline">Create one</Link>
        </p>
      </form>
    </div>
  );
}
