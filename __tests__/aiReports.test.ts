import type { MetaRepo } from '../src/core/ports';
import {
  MAIL_TEXT_MAX,
  MAIL_URL_MAX,
  REPORTS_KEEP,
  REPORT_NOTE_MAX,
  REPORT_TEXT_MAX,
  buildReportMail,
  clip,
  connectAiReports,
  makeReport,
  parseReports,
  useAiReports,
  withReport,
  type AiReport,
} from '../src/state/useAiReports';

function memoryRepo(initial: Record<string, string> = {}): MetaRepo & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    get: key => data[key] ?? null,
    set: (key, value) => {
      data[key] = value;
    },
    remove: key => {
      delete data[key];
    },
  };
}

const report = (id: string, extra: Partial<AiReport> = {}): AiReport => ({
  id,
  feature: 'assistant',
  reason: 'offensive',
  note: '',
  text: 'An answer',
  createdAt: 1,
  ...extra,
});

describe('report records', () => {
  it('trims and shortens the note and the answer, and keeps the chat message id', () => {
    const made = makeReport(
      { feature: 'script', reason: 'wrong', note: `  ${'n'.repeat(REPORT_NOTE_MAX + 50)}  `, text: 'x'.repeat(REPORT_TEXT_MAX + 10), answerId: 'm1' },
      'r1',
      42,
    );
    expect(made.id).toBe('r1');
    expect(made.createdAt).toBe(42);
    expect(Array.from(made.note)).toHaveLength(REPORT_NOTE_MAX);
    expect(made.note.endsWith('…')).toBe(true);
    expect(Array.from(made.text)).toHaveLength(REPORT_TEXT_MAX);
    expect(made.answerId).toBe('m1');
    expect('answerId' in makeReport({ feature: 'world', reason: 'other', note: '', text: 'a' }, 'r2', 1)).toBe(false);
  });

  it('never splits an emoji when shortening', () => {
    expect(clip('😀😀😀', 2)).toBe('😀…');
    expect(clip('short', 10)).toBe('short');
  });

  it('puts the newest first and keeps only the latest reports', () => {
    let list: AiReport[] = [];
    for (let i = 0; i < REPORTS_KEEP + 5; i++) {
      list = withReport(list, report(`r${i}`));
    }
    expect(list).toHaveLength(REPORTS_KEEP);
    expect(list[0].id).toBe(`r${REPORTS_KEEP + 4}`);
    expect(withReport([report('a'), report('b')], report('a', { note: 'again' })).map(item => item.id)).toEqual(['a', 'b']);
  });

  it('reads saved reports and drops anything broken or unknown', () => {
    const good = report('ok', { answerId: 'm1' });
    const raw = JSON.stringify([good, { ...good, id: 'bad-reason', reason: 'spam' }, { ...good, id: 'bad-feature', feature: 'x' }, null, 'text']);
    expect(parseReports(raw)).toEqual([good]);
    expect(parseReports('not json')).toEqual([]);
    expect(parseReports('{"a":1}')).toEqual([]);
    expect(parseReports(null)).toEqual([]);
  });
});

describe('report store', () => {
  afterEach(() => connectAiReports(null));

  it('loads saved reports when connected', () => {
    const repo = memoryRepo({ aiReports: JSON.stringify([report('saved')]) });
    connectAiReports(repo);
    expect(useAiReports.getState().reports.map(item => item.id)).toEqual(['saved']);
  });

  it('saves a new report with its time and survives a restart', () => {
    const repo = memoryRepo();
    connectAiReports(repo);
    const added = useAiReports.getState().add({
      feature: 'assistant',
      reason: 'sexual',
      note: ' too much ',
      text: 'The answer',
      answerId: 'm7',
    });
    expect(added.note).toBe('too much');
    expect(added.createdAt).toBeGreaterThan(0);
    expect(useAiReports.getState().reports[0]).toBe(added);

    connectAiReports(memoryRepo(repo.data));
    expect(useAiReports.getState().reports).toEqual([added]);
  });

  it('clears every report and removes the saved list', () => {
    const repo = memoryRepo();
    connectAiReports(repo);
    useAiReports.getState().add({ feature: 'world', reason: 'violent', note: '', text: 'x' });
    expect(repo.data.aiReports).toBeDefined();
    useAiReports.getState().clear();
    expect(useAiReports.getState().reports).toEqual([]);
    expect(repo.data.aiReports).toBeUndefined();
  });
});

describe('report email', () => {
  const info = { appName: 'Manganova', appVersion: '1.2.3', platform: 'android 35', language: 'vi' };

  it('fills the subject and body with the reason, note, feature, version and answer', () => {
    const mail = buildReportMail('dev@example.com', report('r9', { reason: 'wrong', feature: 'plotHoles', note: 'Made up a chapter', text: 'Chapter 4 contradicts…', createdAt: Date.UTC(2026, 10, 11) }), info);
    expect(mail.subject).toBe('Manganova: AI answer report (Wrong or misleading)');
    expect(mail.body).toContain('Reason: Wrong or misleading');
    expect(mail.body).toContain('Feature: Find plot holes');
    expect(mail.body).toContain('Note: Made up a chapter');
    expect(mail.body).toContain('App version: 1.2.3');
    expect(mail.body).toContain('Platform: android 35');
    expect(mail.body).toContain('Language: vi');
    expect(mail.body).toContain('Report ID: r9');
    expect(mail.body).toContain('Reported at: 2026-11-11T00:00:00.000Z');
    expect(mail.body.endsWith('Chapter 4 contradicts…')).toBe(true);
  });

  it('says when there is no note', () => {
    expect(buildReportMail('a@b.c', report('r'), info).body).toContain('Note: (none)');
  });

  it('builds a mailto link that decodes back to the subject and body', () => {
    const mail = buildReportMail('dev@example.com', report('r', { note: 'a & b ? c = d #e', text: 'Line one\nLine two 😀' }), info);
    expect(mail.url.startsWith('mailto:dev@example.com?subject=')).toBe(true);
    const query = mail.url.slice(mail.url.indexOf('?') + 1);
    const params = Object.fromEntries(query.split('&').map(part => part.split('=').map(decodeURIComponent)));
    expect(params.subject).toBe(mail.subject);
    expect(params.body).toBe(mail.body);
  });

  it('shortens a long answer so the link stays a safe length', () => {
    const long = '😀'.repeat(REPORT_TEXT_MAX);
    const mail = buildReportMail('dev@example.com', report('r', { text: long }), info);
    const answer = mail.body.slice(mail.body.indexOf('AI answer:\n') + 'AI answer:\n'.length);
    expect(Array.from(answer).length).toBeLessThanOrEqual(MAIL_TEXT_MAX);
    expect(answer.endsWith('…')).toBe(true);
    expect(mail.url.length).toBeLessThanOrEqual(MAIL_URL_MAX);
    expect(() => decodeURIComponent(mail.url)).not.toThrow();
  });

  it('keeps the link short for Japanese text and a long note, which grow when encoded', () => {
    const mail = buildReportMail('dev@example.com', report('r', { text: 'これは長い答えです。'.repeat(150), note: 'メモ'.repeat(250) }), info);
    expect(mail.url.length).toBeLessThanOrEqual(MAIL_URL_MAX);
    expect(mail.body).toContain('これは長い答え');
  });

  it('keeps a short answer whole', () => {
    const mail = buildReportMail('dev@example.com', report('r', { text: 'Short answer' }), info);
    expect(mail.body.endsWith('Short answer')).toBe(true);
  });
});
