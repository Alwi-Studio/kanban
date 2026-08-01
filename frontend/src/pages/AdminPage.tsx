import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Crown, KeyRound, Search, ShieldCheck, Trash2, Users as UsersIcon, X } from "lucide-react";
import Layout from "../components/Layout/Layout";
import RoleBadge from "../components/ui/RoleBadge";
import StatCard from "../components/ui/StatCard";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { useToast } from "../components/ui/Toast";
import { useAuthStore } from "../store/authStore";
import { deleteUser, getAdminUsers, setGlobalAdmin, setUserPassword } from "../services/admin";
import type { AdminUser } from "../types";

function apiError(error: any, fallback: string) {
  return error?.response?.data?.error || fallback;
}

// Order roles by seniority so the most privileged access reads first.
const ROLE_ORDER = ["admin", "pm", "member", "viewer"];

function roleSummary(user: AdminUser): { role: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const m of user.memberships) counts.set(m.role, (counts.get(m.role) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => ROLE_ORDER.indexOf(a[0]) - ROLE_ORDER.indexOf(b[0]))
    .map(([role, count]) => ({ role, count }));
}

export default function AdminPage() {
  const currentUser = useAuthStore(s => s.user);
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ user: AdminUser; next: boolean } | null>(null);
  const [passwordUser, setPasswordUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deletePending, setDeletePending] = useState<AdminUser | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getAdminUsers();
        if (active) setUsers(data);
      } catch (error: any) {
        if (active) setLoadError(apiError(error, "Could not load users"));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);

  const adminCount = useMemo(() => users.filter(u => u.isGlobalAdmin).length, [users]);

  const confirmToggle = async () => {
    if (!pending) return;
    const { user, next } = pending;
    setPending(null);
    setSavingId(user.id);
    try {
      const updated = await setGlobalAdmin(user.id, next);
      setUsers(current => current.map(u => (u.id === updated.id ? updated : u)));
      toast(next ? `${updated.name} is now a global admin` : `Removed global admin from ${updated.name}`, "success");
    } catch (error: any) {
      toast(apiError(error, "Failed to update admin access"), "error");
    } finally {
      setSavingId(null);
    }
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!passwordUser) return;
    if (newPassword.length < 6) {
      toast("Password must be at least 6 characters", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast("Passwords do not match", "error");
      return;
    }

    setSavingId(passwordUser.id);
    try {
      await setUserPassword(passwordUser.id, newPassword);
      toast(`Password updated for ${passwordUser.name}`, "success");
      setPasswordUser(null);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast(apiError(error, "Failed to update password"), "error");
    } finally {
      setSavingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deletePending) return;
    const target = deletePending;
    setDeletePending(null);
    setSavingId(target.id);
    try {
      await deleteUser(target.id);
      setUsers(current => current.filter(user => user.id !== target.id));
      toast(`${target.name}'s account was deleted`, "success");
    } catch (error: any) {
      toast(apiError(error, "Failed to delete account"), "error");
    } finally {
      setSavingId(null);
    }
  };

  // Non-admins never see this screen; the API also enforces it.
  if (currentUser && !currentUser.isGlobalAdmin) return <Navigate to="/" replace />;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
            <Crown size={22} className="text-brand" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin · Users</h1>
            <p className="text-sm text-gray-500 mt-0.5">See who has access, and grant or revoke global admin.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Total users" value={users.length} icon={<UsersIcon size={18} />} color="brand" />
          <StatCard label="Global admins" value={adminCount} icon={<Crown size={18} />} color="brand" />
          <StatCard label="Board admins" value={users.reduce((n, u) => n + u.adminBoardCount, 0)} icon={<ShieldCheck size={18} />} color="warning" />
        </div>

        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email"
            aria-label="Search users"
            className="input pl-9"
          />
        </div>

        <div className="card overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-7 h-7 rounded-full border-4 border-brand/20 border-t-brand animate-spin" aria-label="Loading users" />
            </div>
          )}

          {!loading && loadError && (
            <p className="text-sm text-red-500 text-center py-16">{loadError}</p>
          )}

          {!loading && !loadError && filtered.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-16">No users match your search.</p>
          )}

          {!loading && !loadError && filtered.map((u, i) => {
            const isSelf = u.id === currentUser?.id;
            const summary = roleSummary(u);
            return (
              <div
                key={u.id}
                className={`flex flex-col gap-3 md:flex-row md:items-center md:gap-4 px-4 sm:px-5 py-4 ${i > 0 ? "border-t border-gray-100 dark:border-gray-800" : ""}`}
              >
                <div className="flex items-center gap-3 min-w-0 md:w-64 shrink-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 ${u.isGlobalAdmin ? "bg-brand" : "bg-gray-400 dark:bg-gray-600"}`}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate flex items-center gap-1.5">
                      {u.name}
                      {isSelf && <span className="text-[10px] font-medium text-brand bg-brand/10 rounded px-1.5 py-0.5">You</span>}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                </div>

                <div className="flex-1 flex flex-wrap items-center gap-1.5 min-w-0">
                  {u.isGlobalAdmin && <RoleBadge role="global" />}
                  {summary.length === 0 && !u.isGlobalAdmin && (
                    <span className="text-xs text-gray-400">No board access</span>
                  )}
                  {summary.map(({ role, count }) => (
                    <span key={role} className="inline-flex items-center gap-1">
                      <RoleBadge role={role} />
                      {count > 1 && <span className="text-[10px] text-gray-400">×{count}</span>}
                    </span>
                  ))}
                </div>

                <div className="shrink-0 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      setPasswordUser(u);
                      setNewPassword("");
                      setConfirmPassword("");
                    }}
                    disabled={savingId === u.id}
                    className="btn-secondary text-xs inline-flex items-center gap-1.5"
                    title={`Change password for ${u.name}`}
                  >
                    <KeyRound size={13} /> Password
                  </button>
                  <button
                    onClick={() => setPending({ user: u, next: !u.isGlobalAdmin })}
                    disabled={savingId === u.id}
                    className={u.isGlobalAdmin ? "btn-secondary text-xs" : "btn-primary text-xs"}
                  >
                    {savingId === u.id ? "Saving…" : u.isGlobalAdmin ? "Revoke admin" : "Make admin"}
                  </button>
                  <button
                    onClick={() => setDeletePending(u)}
                    disabled={isSelf || savingId === u.id}
                    className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    title={isSelf ? "You cannot delete your own account here" : `Delete ${u.name}'s account`}
                    aria-label={`Delete ${u.name}'s account`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ConfirmDialog
        open={!!pending}
        variant={pending?.next ? "brand" : "danger"}
        title={pending?.next ? "Grant global admin?" : "Revoke global admin?"}
        message={
          pending?.next
            ? `${pending?.user.name} will get full access to every board and this admin panel.`
            : `${pending?.user.name} will lose org-wide access and keep only their board roles.`
        }
        confirmLabel={pending?.next ? "Make admin" : "Revoke"}
        onConfirm={confirmToggle}
        onCancel={() => setPending(null)}
      />

      <ConfirmDialog
        open={!!deletePending}
        title="Delete account?"
        message={`${deletePending?.name}'s account, owned workspaces, and boards will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete account"
        onConfirm={confirmDelete}
        onCancel={() => setDeletePending(null)}
      />

      {passwordUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPasswordUser(null)} />
          <form onSubmit={savePassword} className="relative bg-white dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl p-6 w-full max-w-sm z-10 animate-scale-in">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Change password</h3>
                <p className="text-xs text-gray-500 mt-1">Set a new password for {passwordUser.name}.</p>
              </div>
              <button type="button" onClick={() => setPasswordUser(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label htmlFor="admin-new-password" className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">New password</label>
                <input id="admin-new-password" type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} minLength={6} autoComplete="new-password" className="input" autoFocus required />
              </div>
              <div>
                <label htmlFor="admin-confirm-password" className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">Confirm password</label>
                <input id="admin-confirm-password" type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} minLength={6} autoComplete="new-password" className="input" required />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setPasswordUser(null)} className="btn-secondary text-xs">Cancel</button>
              <button type="submit" disabled={savingId === passwordUser.id} className="btn-primary text-xs">
                {savingId === passwordUser.id ? "Saving…" : "Update password"}
              </button>
            </div>
          </form>
        </div>
      )}
    </Layout>
  );
}
