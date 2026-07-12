interface AvatarStackProps {
  users?: { id: string; name: string }[];
  max?: number;
  size?: "sm" | "md";
}

const colors = ["#6C4EF5", "#2ECC71", "#F5A623", "#E74C3C", "#8B5CF6", "#EC4899", "#3498DB", "#1ABC9C"];

function hashCode(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export default function AvatarStack({ users, max = 3, size = "sm" }: AvatarStackProps) {
  if (!users || users.length === 0) return null;
  const shown = users.slice(0, max);
  const remaining = users.length - max;
  const dim = size === "sm" ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs";

  return (
    <div className="flex items-center">
      {shown.map((u) => (
        <div
          key={u.id}
          className={`${dim} rounded-full flex items-center justify-center text-white font-medium -ml-1.5 first:ml-0 ring-2 ring-white dark:ring-gray-900`}
          style={{ backgroundColor: colors[hashCode(u.id) % colors.length], zIndex: shown.length }}
          title={u.name}
        >
          {u.name.charAt(0)}
        </div>
      ))}
      {remaining > 0 && (
        <div className={`${dim} rounded-full flex items-center justify-center font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 -ml-1.5 ring-2 ring-white dark:ring-gray-900`}>
          +{remaining}
        </div>
      )}
    </div>
  );
}
