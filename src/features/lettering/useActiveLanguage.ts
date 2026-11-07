import { create } from 'zustand';

import type { ID, Project } from '../../core/model/types';

type ActiveLanguageState = {
  byProject: Record<ID, string | null>;
  setLanguage: (projectId: ID, lang: string | null) => void;
};

const useActiveLanguageStore = create<ActiveLanguageState>(set => ({
  byProject: {},
  setLanguage: (projectId, lang) => set(state => ({ byProject: { ...state.byProject, [projectId]: lang } })),
}));

/** Per story, for this run of the app. A language that has since been removed reads as the original. */
export function useActiveLanguage(project: Project | undefined): [string | null, (lang: string | null) => void] {
  const stored = useActiveLanguageStore(s => (project ? s.byProject[project.id] ?? null : null));
  const lang = stored && project?.languages?.includes(stored) ? stored : null;
  const projectId = project?.id;
  const setLang = (next: string | null) => {
    if (projectId) {
      useActiveLanguageStore.getState().setLanguage(projectId, next);
    }
  };
  return [lang, setLang];
}
