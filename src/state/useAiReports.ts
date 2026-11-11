import { create } from 'zustand';

import { makeReport, parseReports, withReport, type AiReport, type ReportInput } from '../core/ai/report';
import type { MetaRepo } from '../core/ports';
import { uid } from '../core/util/id';

export * from '../core/ai/report';

const KEY = 'aiReports';

let repo: MetaRepo | null = null;

type AiReportsStore = {
  reports: AiReport[];
  /** Saves a report on the device and returns it. */
  add: (input: ReportInput) => AiReport;
  clear: () => void;
};

/** AI answers the person reported. Kept on the device: there is no server for reports. */
export const useAiReports = create<AiReportsStore>()((set, get) => {
  const save = (reports: AiReport[]) => {
    set({ reports });
    if (reports.length) {
      repo?.set(KEY, JSON.stringify(reports));
    } else {
      repo?.remove(KEY);
    }
  };
  return {
    reports: [],
    add: input => {
      const report = makeReport(input, uid(), Date.now());
      save(withReport(get().reports, report));
      return report;
    },
    clear: () => save([]),
  };
});

export function connectAiReports(next: MetaRepo | null): void {
  repo = next;
  useAiReports.setState({ reports: parseReports(next?.get(KEY)) });
}
