import prisma from "../lib/prisma";


interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  avgCompletionTime: number | null;
  tasksPerColumn: { name: string; count: number; percentage: number }[];
  topContributors: { userId: string; name: string; email: string; completedCount: number }[];
  recentTasks: {
    id: string;
    title: string;
    columnName: string;
    boardId: string;
    boardName: string;
    dueDate: string | null;
    assignees: { id: string; name: string }[];
  }[];
  taskTrends: { date: string; completed: number; created: number }[];
}

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const boards = await prisma.board.findMany({
    where: {
      members: { some: { userId } },
    },
    include: {
      columns: {
        orderBy: { position: "asc" },
        include: {
          tasks: {
            include: {
              assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
              _count: { select: { comments: true, attachments: true } },
            },
          },
        },
      },
    },
  });

  const allTasks = boards.flatMap((b) => b.columns.flatMap((c) => c.tasks));
  const doneTasks = allTasks.filter((t) => {
    const col = boards.flatMap((b) => b.columns).find((c) => c.tasks.some((x) => x.id === t.id));
    return col?.name === "Done";
  });
  const overdueTasks = allTasks.filter((t) => {
    if (!t.dueDate) return false;
    const col = boards.flatMap((b) => b.columns).find((c) => c.tasks.some((x) => x.id === t.id));
    return new Date(t.dueDate) < new Date() && col?.name !== "Done";
  });

  let avgCompletionTime: number | null = null;
  const completedWithDuration = doneTasks.filter((t) => {
    return t.createdAt;
  });
  if (completedWithDuration.length > 0) {
    const totalMs = completedWithDuration.reduce((sum, t) => {
      return sum + (new Date().getTime() - new Date(t.createdAt).getTime());
    }, 0);
    avgCompletionTime = Math.round(totalMs / completedWithDuration.length / (1000 * 60 * 60 * 24) * 10) / 10;
  }

  const columnCounts = new Map<string, number>();
  for (const b of boards) {
    for (const c of b.columns) {
      columnCounts.set(c.name, (columnCounts.get(c.name) || 0) + c.tasks.length);
    }
  }
  const total = allTasks.length || 1;
  const tasksPerColumn = Array.from(columnCounts.entries()).map(([name, count]) => ({
    name,
    count,
    percentage: Math.round((count / total) * 100),
  }));

  const contributorMap = new Map<string, { name: string; email: string; count: number }>();
  for (const t of doneTasks) {
    for (const a of t.assignees) {
      const existing = contributorMap.get(a.user.id);
      if (existing) {
        existing.count++;
      } else {
        contributorMap.set(a.user.id, { name: a.user.name, email: a.user.email, count: 1 });
      }
    }
  }
  const topContributors = Array.from(contributorMap.entries())
    .map(([userId, val]) => ({ userId, name: val.name, email: val.email, completedCount: val.count }))
    .sort((a, b) => b.completedCount - a.completedCount)
    .slice(0, 5);

  const flatTasks = allTasks
    .map((t) => {
      const col = boards.flatMap((b) => b.columns).find((c) => c.tasks.some((x) => x.id === t.id));
      const board = boards.find((b) => b.columns.some((c) => c.tasks.some((x) => x.id === t.id)));
      return {
        id: t.id,
        title: t.title,
        columnName: col?.name || "",
        boardId: board?.id || "",
        boardName: board?.name || "",
        dueDate: t.dueDate?.toISOString() || null,
        assignees: t.assignees.map((a) => ({ id: a.user.id, name: a.user.name })),
        createdAt: t.createdAt,
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  const now = new Date();
  const trendMap = new Map<string, { completed: number; created: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    trendMap.set(key, { completed: 0, created: 0 });
  }
  for (const t of doneTasks) {
    const key = t.createdAt.toISOString().slice(0, 10);
    if (trendMap.has(key)) {
      trendMap.get(key)!.completed++;
    }
  }
  for (const t of allTasks) {
    const key = t.createdAt.toISOString().slice(0, 10);
    if (trendMap.has(key)) {
      trendMap.get(key)!.created++;
    }
  }
  const taskTrends = Array.from(trendMap.entries()).map(([date, val]) => ({
    date,
    ...val,
  }));

  return {
    totalTasks: allTasks.length,
    completedTasks: doneTasks.length,
    overdueTasks: overdueTasks.length,
    avgCompletionTime,
    tasksPerColumn,
    topContributors,
    recentTasks: flatTasks,
    taskTrends,
  };
}
