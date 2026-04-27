/**
 * Реестр фоновых задач для мониторинга: название, инициатор, прогресс %, время старта.
 * In-memory хранилище (сброс при перезапуске). Задачи могут проверять isInterrupted и завершаться.
 */
export interface BackgroundTaskRecord {
  id: string;
  name: string;
  initiatorId: string;
  progress: number;
  startedAt: Date;
  interrupted: boolean;
}

const tasks = new Map<string, BackgroundTaskRecord>();

export function registerTask(
  id: string,
  params: { name: string; initiatorId: string }
): void {
  tasks.set(id, {
    id,
    name: params.name,
    initiatorId: params.initiatorId,
    progress: 0,
    startedAt: new Date(),
    interrupted: false,
  });
}

export function updateTaskProgress(id: string, progress: number): void {
  const t = tasks.get(id);
  if (t) t.progress = Math.min(100, Math.max(0, progress));
}

export function setInterrupted(id: string): void {
  const t = tasks.get(id);
  if (t) t.interrupted = true;
}

export function isInterrupted(id: string): boolean {
  return tasks.get(id)?.interrupted ?? false;
}

export function removeTask(id: string): void {
  tasks.delete(id);
}

export function getActiveTasks(): BackgroundTaskRecord[] {
  return Array.from(tasks.values()).filter((t) => !t.interrupted);
}
