import type { ID, Project } from '../../model/types';

export function omit<T>(record: Record<ID, T>, ids: Iterable<ID>): Record<ID, T> {
  const next = { ...record };
  for (const id of ids) {
    delete next[id];
  }
  return next;
}

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from < 0 || from >= next.length) {
    return next;
  }
  const [item] = next.splice(from, 1);
  next.splice(Math.min(Math.max(0, to), next.length), 0, item);
  return next;
}

export function touchProject(projects: Record<ID, Project>, projectId: ID | undefined, now: number): Record<ID, Project> {
  const project = projectId ? projects[projectId] : undefined;
  return project ? { ...projects, [project.id]: { ...project, updatedAt: now } } : projects;
}
