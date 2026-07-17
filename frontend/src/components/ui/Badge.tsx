interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  size?: "sm" | "md";
}

export default function Badge({ children, color = "#ff5a30", size = "sm" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"}`}
      style={{ backgroundColor: color + "18", color }}
    >
      {children}
    </span>
  );
}
