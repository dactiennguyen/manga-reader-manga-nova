import { msg } from '../i18n';
import { GENRES, LIMITS } from '../model/constants';
import type { PageSize, Project, ProjectFormat } from '../model/types';

export type FormatKey = 'manga-B5' | 'manga-A5' | 'webtoon';

export type FormatOption = { key: FormatKey; format: ProjectFormat; pageSize: PageSize; label: string; hint: string };

export const FORMATS: FormatOption[] = [
  {
    key: 'manga-B5',
    format: 'manga',
    pageSize: 'B5',
    label: msg('Manga page B5'),
    hint: msg('Common print size, read page by page'),
  },
  {
    key: 'manga-A5',
    format: 'manga',
    pageSize: 'A5',
    label: msg('Manga page A5'),
    hint: msg('Compact size, great for short stories'),
  },
  {
    key: 'webtoon',
    format: 'webtoon',
    pageSize: 'B5',
    label: msg('Webtoon'),
    hint: msg('Vertical strip, scroll to read on a phone'),
  },
];

export function knownGenres(list: string[] | undefined): string[] {
  const known: readonly string[] = GENRES;
  return (list ?? [])
    .filter((genre, index, all) => known.includes(genre) && all.indexOf(genre) === index)
    .slice(0, LIMITS.genresPerProject);
}

export function genresFavoritesFirst(favorites: string[]): string[] {
  return [...GENRES.filter(genre => favorites.includes(genre)), ...GENRES.filter(genre => !favorites.includes(genre))];
}

export function titleTaken(projects: Record<string, Project>, name: string): boolean {
  const title = name.trim().toLowerCase();
  return !!title && Object.values(projects).some(item => !item.deletedAt && item.title.trim().toLowerCase() === title);
}
