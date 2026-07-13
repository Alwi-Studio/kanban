import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../services/auth";
import { useAuthStore } from "../store/authStore";

export default function RegisterPage() {
  const [name, setName] = useState("");
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
      const res = await register(name, email, password);
      setUser(res.user);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.error || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-page dark:bg-bg-dark px-4 py-8">
      <form onSubmit={handleSubmit} className="card p-8 sm:p-10 w-full max-w-md shadow-xl">
        <div className="w-11 h-11 rounded-xl bg-brand flex items-center justify-center text-white font-bold mx-auto mb-5">A</div>
        <h1 className="text-2xl font-bold mb-1 text-center text-gray-900 dark:text-white">Create your account</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-7">Start organizing work with your team</p>
        {error && <p className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2.5 text-sm mb-4" role="alert">{error}</p>}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            autoComplete="name"
            required
          />
        </div>
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
            autoComplete="new-password"
            required
            minLength={6}
          />
        </div>
        <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5">
          {submitting ? "Creating account..." : "Register"}
        </button>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-5">
          Already have an account? <Link to="/login" className="text-brand font-semibold hover:underline">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
