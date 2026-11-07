import { useEffect, useMemo, useRef, useState } from 'react';

import type { ExportRecord } from '../../core/export/history';
import { extraPageCount, resolveOptions, type ExportOptions } from '../../core/export/plan';
import { translationProgress } from '../../core/lettering/translation';
import type { ID } from '../../core/model/types';
import { toAbsolute } from '../../core/util/paths';
import { RNFS, saveToDevice, shareFile } from '../../native/files';
import { useChapters, useProject } from '../../state/hooks';
import { useSettings } from '../../state/useSettings';
import { useStory } from '../../state/useStory';
import { confirm, toast } from '../../ui';
import { deleteExport, readExportHistory, recordExport } from './exportFiles';
import { ExportCancelled, runExport } from './runExport';

export type ExportPhase =
  | { kind: 'idle' }
  | { kind: 'running'; done: number; total: number }
  | { kind: 'done'; result: ExportRecord }
  | { kind: 'error'; message: string };

export function useExportScreen(projectId: ID, chapterId: ID | undefined, onDone: () => void) {
  const project = useProject(projectId);
  const chapters = useChapters(projectId);
  const pages = useStory(s => s.pages);

  const chapterPages = useMemo(() => {
    const out: Record<ID, ID[]> = {};
    for (const chapter of chapters) {
      out[chapter.id] = chapter.pageIds.filter(id => !!pages[id]);
    }
    return out;
  }, [chapters, pages]);
  const selectable = useMemo(
    () => chapters.filter(ch => chapterPages[ch.id].length > 0).map(ch => ch.id),
    [chapters, chapterPages],
  );

  const [selected, setSelected] = useState<ID[]>(() =>
    chapterId && selectable.includes(chapterId) ? [chapterId] : selectable,
  );
  const [form, setForm] = useState<ExportOptions>(() => ({
    format: project?.format === 'webtoon' ? 'long' : 'pdf',
    quality: 1,
    spread: false,
    cover: false,
    info: false,
    penName: useSettings.getState().penName,
    longWidth: 800,
    autoCut: true,
    gap: 0,
    lang: null,
  }));
  const [phase, setPhase] = useState<ExportPhase>({ kind: 'idle' });
  const [history, setHistory] = useState<ExportRecord[]>(() => readExportHistory(projectId));
  const [missing, setMissing] = useState<Record<string, boolean>>({});
  const cancelRef = useRef(false);

  useEffect(
    () => () => {
      cancelRef.current = true;
    },
    [],
  );

  useEffect(() => {
    let alive = true;
    Promise.all(history.map(item => RNFS.exists(toAbsolute(item.path)).catch(() => false))).then(flags => {
      if (alive) {
        const next: Record<string, boolean> = {};
        history.forEach((item, i) => {
          next[item.path] = !flags[i];
        });
        setMissing(next);
      }
    });
    return () => {
      alive = false;
    };
  }, [history]);

  const pageIds = useMemo(
    () => chapters.filter(ch => selected.includes(ch.id)).flatMap(ch => chapterPages[ch.id]),
    [chapters, selected, chapterPages],
  );
  const unfinished = pageIds.filter(id => !pages[id].done).length;
  const languages = project?.languages ?? [];
  const options = resolveOptions(form, languages);
  const translated = options.lang
    ? translationProgress(
        pageIds.flatMap(id => pages[id]?.bubbles ?? []),
        options.lang,
      )
    : null;

  const patch = (next: Partial<ExportOptions>) => setForm(current => ({ ...current, ...next }));

  const toggle = (id: ID, on: boolean) => setSelected(list => (on ? [...list, id] : list.filter(item => item !== id)));

  const start = async () => {
    if (pageIds.length === 0) {
      toast('Pick at least one chapter');
      return;
    }
    if (unfinished > 0) {
      const ok = await confirm(
        'Export unfinished pages?',
        `${unfinished} ${unfinished === 1 ? 'page is' : 'pages are'} not done and will still be exported.`,
        { confirmText: 'Export anyway' },
      );
      if (!ok) {
        return;
      }
    }
    cancelRef.current = false;
    setPhase({ kind: 'running', done: 0, total: pageIds.length });
    try {
      const result = await runExport(
        projectId,
        pageIds,
        options,
        progress => setPhase({ kind: 'running', ...progress }),
        () => cancelRef.current,
      );
      setHistory(recordExport(projectId, result));
      setPhase({ kind: 'done', result });
      onDone();
    } catch (error) {
      if (cancelRef.current || error instanceof ExportCancelled) {
        setPhase({ kind: 'idle' });
        toast('Export cancelled');
      } else {
        setPhase({ kind: 'error', message: error instanceof Error && error.message ? error.message : 'Unknown error' });
      }
    }
  };

  const cancel = () => {
    cancelRef.current = true;
  };

  const share = (item: ExportRecord) =>
    shareFile(item.path, item.mime, project?.title ?? item.fileName).catch(() => toast("Couldn't share the file"));

  const save = async (item: ExportRecord) => {
    try {
      if (await saveToDevice(item.path, item.fileName, item.mime)) {
        toast('Saved to device');
      }
    } catch {
      toast("Couldn't save the file");
    }
  };

  const remove = async (item: ExportRecord) => {
    const gone = !!missing[item.path];
    const ok = await confirm(
      gone ? 'Remove from history?' : `Delete ${item.fileName}?`,
      gone ? undefined : 'The exported file will be removed from this device.',
      { confirmText: gone ? 'Remove' : 'Delete', destructive: true },
    );
    if (!ok) {
      return;
    }
    setHistory(await deleteExport(projectId, item.path));
    setPhase(current => (current.kind === 'done' && current.result.path === item.path ? { kind: 'idle' } : current));
  };

  return {
    project,
    chapters,
    chapterPages,
    pages,
    selectable,
    selected,
    setSelected,
    toggle,
    form,
    patch,
    options,
    languages,
    translated,
    pageIds,
    unfinished,
    totalPages: pageIds.length + extraPageCount(options),
    allSelected: selectable.length > 0 && selectable.every(id => selected.includes(id)),
    phase,
    history,
    missing,
    start,
    cancel,
    share,
    save,
    remove,
  };
}
