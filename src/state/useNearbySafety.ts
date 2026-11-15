import { create } from 'zustand';

import type { MetaRepo } from '../core/ports';
import {
  isBlocked,
  makePersonReport,
  newSafetyKey,
  parseSafety,
  withBlocked,
  withoutBlocked,
  withPersonReport,
  type BlockedPerson,
  type PersonReport,
  type PersonReportInput,
} from '../core/nearby/safety';
import { uid } from '../core/util/id';

export * from '../core/nearby/safety';

const KEY = 'nearbySafety';

let repo: MetaRepo | null = null;

type NearbySafetyStore = {
  /** This phone's key in rooms. Made once and kept. */
  key: string;
  blocked: BlockedPerson[];
  reports: PersonReport[];
  isBlocked: (key: string | undefined) => boolean;
  block: (key: string, name: string) => void;
  unblock: (key: string) => void;
  report: (input: PersonReportInput) => PersonReport;
  clearReports: () => void;
};

/** People blocked and reported in Play together. Kept on the device: there is no server. */
export const useNearbySafety = create<NearbySafetyStore>()((set, get) => {
  const save = (patch: Partial<Pick<NearbySafetyStore, 'blocked' | 'reports'>>) => {
    set(patch);
    const { key, blocked, reports } = get();
    repo?.set(KEY, JSON.stringify({ key, blocked, reports }));
  };
  return {
    key: newSafetyKey(),
    blocked: [],
    reports: [],
    isBlocked: key => isBlocked(get().blocked, key),
    block: (key, name) => save({ blocked: withBlocked(get().blocked, { key, name: name.trim().slice(0, 60), at: Date.now() }) }),
    unblock: key => save({ blocked: withoutBlocked(get().blocked, key) }),
    report: input => {
      const report = makePersonReport(input, uid(), Date.now());
      save({ reports: withPersonReport(get().reports, report) });
      return report;
    },
    clearReports: () => save({ reports: [] }),
  };
});

export function connectNearbySafety(next: MetaRepo | null): void {
  repo = next;
  const raw = next?.get(KEY);
  const data = parseSafety(raw, newSafetyKey);
  useNearbySafety.setState(data);
  if (next && !raw) {
    // The key is kept from the first launch on, so a block holds across rooms.
    next.set(KEY, JSON.stringify(data));
  }
}
