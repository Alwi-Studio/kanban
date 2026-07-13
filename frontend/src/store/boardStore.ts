import { create } from "zustand";
import type { Board, Task, Column, Label, BoardMember } from "../types";

interface BoardState {
  currentBoard: Board | null;
  setCurrentBoard: (board: Board | null) => void;
  moveTask: (taskId: string, fromColId: string, toColId: string, newPosition: number, newVersion: number) => void;
  updateTaskInState: (task: Task) => void;
  removeTaskFromState: (taskId: string) => void;
  addTaskToState: (task: Task) => void;
  updateColumnInState: (col: Column) => void;
  removeColumnFromState: (colId: string) => void;
  addColumnToState: (col: Column) => void;
  addLabelToBoard: (label: Label) => void;
  removeLabelFromBoard: (labelId: string) => void;
  addMemberToBoard: (member: BoardMember) => void;
  updateMemberInBoard: (member: BoardMember) => void;
  removeMemberFromBoard: (userId: string) => void;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  currentBoard: null,
  setCurrentBoard: (board) => set({ currentBoard: board }),

  moveTask: (taskId, fromColId, toColId, newPosition, newVersion) => {
    const board = get().currentBoard;
    if (!board) return;
    const task = board.columns.flatMap((column) => column.tasks).find((item) => item.id === taskId);
    if (!task) return;
    const newColumns = board.columns.map((col) => {
      const withoutTask = col.tasks.filter((item) => item.id !== taskId);
      if (col.id === toColId) {
        const updatedTask = { ...task, columnId: toColId, position: newPosition, version: newVersion };
        const tasks = [...withoutTask, updatedTask].sort(
          (a, b) => a.position - b.position,
        );
        return { ...col, tasks };
      }
      if (col.id === fromColId) return { ...col, tasks: withoutTask };
      return col;
    });
    set({ currentBoard: { ...board, columns: newColumns } });
  },

  updateTaskInState: (task) => {
    const board = get().currentBoard;
    if (!board) return;
    const newColumns = board.columns.map((col) => {
      const tasks = col.tasks.map((t) => (t.id === task.id ? task : t));
      const moved = col.id !== task.columnId && col.tasks.some((t) => t.id === task.id);
      if (moved) {
        return { ...col, tasks: col.tasks.filter((t) => t.id !== task.id) };
      }
      if (col.id === task.columnId && col.tasks.some((t) => t.id === task.id)) {
        return { ...col, tasks };
      }
      if (col.id === task.columnId && !col.tasks.some((t) => t.id === task.id)) {
        return { ...col, tasks: [...col.tasks, task].sort((a, b) => a.position - b.position) };
      }
      return col;
    });
    set({ currentBoard: { ...board, columns: newColumns } });
  },

  removeTaskFromState: (taskId) => {
    const board = get().currentBoard;
    if (!board) return;
    const newColumns = board.columns.map((col) => ({
      ...col,
      tasks: col.tasks.filter((t) => t.id !== taskId),
    }));
    set({ currentBoard: { ...board, columns: newColumns } });
  },

  addTaskToState: (task) => {
    const board = get().currentBoard;
    if (!board) return;
    const newColumns = board.columns.map((col) => {
      if (col.id === task.columnId) {
        if (col.tasks.some((t) => t.id === task.id)) return col;
        return { ...col, tasks: [...col.tasks, task].sort((a, b) => a.position - b.position) };
      }
      return col;
    });
    set({ currentBoard: { ...board, columns: newColumns } });
  },

  updateColumnInState: (col) => {
    const board = get().currentBoard;
    if (!board) return;
    const newColumns = board.columns.map((c) => (c.id === col.id ? { ...c, ...col, tasks: col.tasks || c.tasks } : c));
    set({ currentBoard: { ...board, columns: newColumns } });
  },

  removeColumnFromState: (colId) => {
    const board = get().currentBoard;
    if (!board) return;
    set({ currentBoard: { ...board, columns: board.columns.filter((c) => c.id !== colId) } });
  },

  addColumnToState: (col) => {
    const board = get().currentBoard;
    if (!board) return;
    if (board.columns.some((c) => c.id === col.id)) return;
    set({ currentBoard: { ...board, columns: [...board.columns, col].sort((a, b) => a.position - b.position) } });
  },

  addLabelToBoard: (label) => {
    const board = get().currentBoard;
    if (!board) return;
    if (board.labels?.some((l) => l.id === label.id)) return;
    set({ currentBoard: { ...board, labels: [...(board.labels || []), label] } });
  },

  removeLabelFromBoard: (labelId) => {
    const board = get().currentBoard;
    if (!board) return;
    set({ currentBoard: { ...board, labels: board.labels?.filter((l) => l.id !== labelId) || [] } });
  },

  addMemberToBoard: (member) => {
    const board = get().currentBoard;
    if (!board) return;
    if (board.members?.some((m) => m.userId === member.userId)) return;
    set({ currentBoard: { ...board, members: [...(board.members || []), member] } });
  },

  updateMemberInBoard: (member) => {
    const board = get().currentBoard;
    if (!board) return;
    const members = board.members?.map((m) => (m.userId === member.userId ? member : m)) || [];
    set({ currentBoard: { ...board, members } });
  },

  removeMemberFromBoard: (userId) => {
    const board = get().currentBoard;
    if (!board) return;
    set({ currentBoard: { ...board, members: board.members?.filter((m) => m.userId !== userId) || [] } });
  },
}));
