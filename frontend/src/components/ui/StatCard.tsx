import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: { value: number; up: boolean };
  icon?: React.ReactNode;
  color?: "brand" | "success" | "warning" | "danger";
}

const colorMap = {
  brand: "text-brand",
  success: "text-green-500",
  warning: "text-yellow-500",
  danger: "text-red-500",
};

export default function StatCard({ label, value, trend, icon, color = "brand" }: StatCardProps) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
        {icon && <span className={colorMap[color]}>{icon}</span>}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      {trend && (
        <div className="flex items-center gap-1 mt-2 text-xs">
          {trend.up ? <TrendingUp size={14} className="text-green-500" /> : <TrendingDown size={14} className="text-red-500" />}
          <span className={trend.up ? "text-green-500" : "text-red-500"}>{trend.value}%</span>
          <span className="text-gray-400">vs last week</span>
        </div>
      )}
    </div>
  );
}
