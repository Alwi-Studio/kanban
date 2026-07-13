import { User, Mail, Calendar } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import Layout from "../components/Layout/Layout";

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>
          <p className="text-sm text-gray-500 mt-1">Your account information</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
            <div className="w-16 h-16 rounded-full bg-brand flex items-center justify-center text-white text-2xl font-bold">
              {user?.name?.charAt(0) || "U"}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{user?.name}</h2>
              <p className="text-sm text-gray-500">{user?.email}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <User size={16} className="text-gray-400" />
              <span className="text-gray-500 w-20">Name</span>
              <span className="text-gray-900 dark:text-white font-medium">{user?.name}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Mail size={16} className="text-gray-400" />
              <span className="text-gray-500 w-20">Email</span>
              <span className="text-gray-900 dark:text-white font-medium">{user?.email}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Calendar size={16} className="text-gray-400" />
              <span className="text-gray-500 w-20">Joined</span>
              <span className="text-gray-900 dark:text-white font-medium">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
