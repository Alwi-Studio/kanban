import { Crown, ShieldCheck, Briefcase, User as UserIcon, Eye, HelpCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type RoleKey = "global" | "owner" | "admin" | "pm" | "member" | "viewer";

interface RoleMeta {
  label: string;
  color: string;
  Icon: LucideIcon;
  title: string;
}

// Each role maps to a design-token color, an icon, and a plain-language tooltip
// so "who has admin" is legible at a glance anywhere a member is shown.
const ROLE_META: Record<RoleKey, RoleMeta> = {
  global: { label: "Global admin", color: "#ff5a30", Icon: Crown, title: "Full access to every board and the admin panel" },
  owner: { label: "Owner", color: "#ff5a30", Icon: Crown, title: "Board owner" },
  admin: { label: "Admin", color: "#F5A623", Icon: ShieldCheck, title: "Can manage this board, its members and settings" },
  pm: { label: "PM", color: "#3B82F6", Icon: Briefcase, title: "Can create and edit tasks" },
  member: { label: "Member", color: "#2ECC71", Icon: UserIcon, title: "Can create and edit tasks" },
  viewer: { label: "Viewer", color: "#8A8FA3", Icon: Eye, title: "Read-only access" },
};

const UNKNOWN: RoleMeta = { label: "Unknown", color: "#8A8FA3", Icon: HelpCircle, title: "Unknown role" };

interface RoleBadgeProps {
  role: string;
  size?: "sm" | "md";
  showIcon?: boolean;
  className?: string;
}

export default function RoleBadge({ role, size = "sm", showIcon = true, className = "" }: RoleBadgeProps) {
  const meta = ROLE_META[role as RoleKey] || UNKNOWN;
  const { label, color, Icon, title } = meta;
  const iconSize = size === "sm" ? 11 : 13;

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 font-semibold rounded-full whitespace-nowrap ${size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"} ${className}`}
      style={{ backgroundColor: color + "1F", color }}
    >
      {showIcon && <Icon size={iconSize} className="shrink-0" strokeWidth={2.4} />}
      {label}
    </span>
  );
}
