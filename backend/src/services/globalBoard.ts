import prisma from "../lib/prisma";

export async function getGlobalBoard(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isGlobalAdmin: true } });
  // The global board is a curated, org-wide list: only boards explicitly marked
  // global appear here, visible to everyone regardless of membership.
  const boards = await prisma.board.findMany({
    where: { isGlobal: true },
    orderBy: { createdAt: "desc" },
    include: {
      workspace: { select: { id: true, name: true } },
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      labels: true,
      columns: {
        orderBy: { position: "asc" },
        include: {
          tasks: {
            orderBy: { position: "asc" },
            include: {
              assignees: {
                include: { user: { select: { id: true, name: true, email: true } } },
              },
              taskLabels: { include: { label: true } },
              _count: { select: { comments: true, attachments: true } },
            },
          },
        },
      },
    },
  });

  return {
    isGlobalAdmin: Boolean(user?.isGlobalAdmin),
    boards: boards.map(({ workspace, ...board }) => ({
      ...board,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
    })),
  };
}
