import { msg } from '../i18n';
import { activeProjects, chapterIdsOf, projectProgress, projectStatus } from '../model/selectors';
import type { Project, ProjectStatus, StoryData } from '../model/types';

export type LibraryFilter = 'all' | ProjectStatus;

export type LibrarySort = 'updated' | 'title' | 'created';

export type LibraryLayout = 'grid' | 'list';

export type LibraryRow = {
  project: Project;
  status: ProjectStatus;
  chapters: number;
  done: number;
  total: number;
  ratio: number;
};

export const LIBRARY_FILTERS: LibraryFilter[] = ['all', 'draft', 'active', 'done'];

export const LIBRARY_SORT_LABEL: Record<LibrarySort, string> = {
  updated: msg('Last edited'),
  title: msg('Title'),
  created: msg('Date created'),
};

const WIDE = 600;
const GAP = 12;
const COLUMN_MIN = 200;

export function libraryRows(state: StoryData): LibraryRow[] {
  return activeProjects(state).map(project => ({
    project,
    status: projectStatus(state, project.id),
    chapters: chapterIdsOf(project).length,
    ...projectProgress(state, project.id),
  }));
}

export function libraryCounts(rows: LibraryRow[]): Record<LibraryFilter, number> {
  const counts: Record<LibraryFilter, number> = { all: rows.length, draft: 0, active: 0, done: 0 };
  rows.forEach(row => {
    counts[row.status] += 1;
  });
  return counts;
}

/** Rows arrive newest first, which is already the 'updated' order. */
export function visibleRows(rows: LibraryRow[], filter: LibraryFilter, query: string, sort: LibrarySort): LibraryRow[] {
  const needle = query.trim().toLocaleLowerCase('vi');
  const list = rows.filter(
    row =>
      (filter === 'all' || row.status === filter) &&
      (!needle || row.project.title.toLocaleLowerCase('vi').includes(needle)),
  );
  if (sort === 'title') {
    return [...list].sort((a, b) => a.project.title.localeCompare(b.project.title, 'vi'));
  }
  if (sort === 'created') {
    return [...list].sort((a, b) => b.project.createdAt - a.project.createdAt);
  }
  return list;
}

export function libraryGrid(
  width: number,
  layout: LibraryLayout,
): { columns: number; padding: number; cardWidth: number } {
  const wide = width >= WIDE;
  const padding = wide ? 24 : 16;
  const columns = layout === 'list' ? 1 : wide ? Math.max(3, Math.floor(width / COLUMN_MIN)) : 2;
  return { columns, padding, cardWidth: Math.floor((width - padding * 2 - GAP * (columns - 1)) / columns) };
}
