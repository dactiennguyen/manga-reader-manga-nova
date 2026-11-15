/**
 * Keeping Play together safe: blocking a person and reporting what they did. There is no server, so both
 * live on this phone. A person is known across rooms by a random key their phone keeps (Member.key); a
 * name alone could be anyone's. The host keeps blocked people out of its rooms; a guest is told when
 * someone they blocked is in the room, so they can leave.
 */
import { clip } from '../ai/report';
import { msg } from '../i18n';
import type { Activity } from './types';

export type PersonReportReason = 'drawing' | 'words' | 'voice' | 'harassment' | 'spam' | 'other';

export const PERSON_REPORT_REASONS: readonly { id: PersonReportReason; label: string }[] = [
  { id: 'drawing', label: msg('Offensive drawing or image') },
  { id: 'words', label: msg('Offensive words') },
  { id: 'voice', label: msg('Offensive voice recording') },
  { id: 'harassment', label: msg('Bullying or harassment') },
  { id: 'spam', label: msg('Spam') },
  { id: 'other', label: msg('Other') },
];

export type BlockedPerson = { key: string; name: string; at: number };

export type PersonReport = {
  id: string;
  /** Their name as the room showed it. */
  name: string;
  /** Their phone's key, when the room knew it. */
  key?: string;
  reason: PersonReportReason;
  note: string;
  /** What the room was playing. */
  activity: Activity;
  createdAt: number;
};

export type PersonReportInput = Omit<PersonReport, 'id' | 'createdAt'>;

export type SafetyData = { key: string; blocked: BlockedPerson[]; reports: PersonReport[] };

/** Same shape the room schema accepts for a key: short, URL-safe. */
export const SAFETY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,32}$/;
export const SAFETY_KEY_LENGTH = 16;
export const BLOCKED_KEEP = 500;
export const PERSON_REPORTS_KEEP = 200;
export const PERSON_NOTE_MAX = 500;

const KEY_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
const REASONS = new Set<string>(PERSON_REPORT_REASONS.map(item => item.id));

/** A new key for this phone. `random` returns 0 ≤ x < 1, like Math.random. */
export function newSafetyKey(random: () => number = Math.random): string {
  let key = '';
  for (let i = 0; i < SAFETY_KEY_LENGTH; i++) {
    key += KEY_CHARS[Math.floor(random() * KEY_CHARS.length) % KEY_CHARS.length];
  }
  return key;
}

export function isBlocked(list: readonly BlockedPerson[], key: string | undefined): boolean {
  return !!key && list.some(person => person.key === key);
}

/** Newest first; blocking again only refreshes the name. */
export function withBlocked(list: readonly BlockedPerson[], person: BlockedPerson): BlockedPerson[] {
  return [person, ...list.filter(item => item.key !== person.key)].slice(0, BLOCKED_KEEP);
}

export function withoutBlocked(list: readonly BlockedPerson[], key: string): BlockedPerson[] {
  return list.filter(item => item.key !== key);
}

export function makePersonReport(input: PersonReportInput, id: string, now: number): PersonReport {
  const report: PersonReport = {
    id,
    name: clip(input.name.trim(), 60),
    reason: input.reason,
    note: clip(input.note.trim(), PERSON_NOTE_MAX),
    activity: input.activity,
    createdAt: now,
  };
  if (input.key) {
    report.key = input.key;
  }
  return report;
}

export function withPersonReport(list: readonly PersonReport[], report: PersonReport): PersonReport[] {
  return [report, ...list.filter(item => item.id !== report.id)].slice(0, PERSON_REPORTS_KEEP);
}

const isString = (value: unknown): value is string => typeof value === 'string';

function isBlockedPerson(value: unknown): value is BlockedPerson {
  const item = value as Record<string, unknown> | null;
  return !!item && isString(item.key) && SAFETY_KEY_PATTERN.test(item.key) && isString(item.name) && typeof item.at === 'number';
}

function isPersonReport(value: unknown): value is PersonReport {
  const item = value as Record<string, unknown> | null;
  return (
    !!item &&
    isString(item.id) &&
    isString(item.name) &&
    isString(item.note) &&
    isString(item.activity) &&
    typeof item.createdAt === 'number' &&
    isString(item.reason) &&
    REASONS.has(item.reason) &&
    (item.key === undefined || isString(item.key))
  );
}

/** Reads what was saved; a missing or broken key gets a fresh one, anything broken is dropped. */
export function parseSafety(raw: string | null | undefined, freshKey: () => string): SafetyData {
  let value: Record<string, unknown> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    value = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    value = {};
  }
  const key = isString(value.key) && SAFETY_KEY_PATTERN.test(value.key) ? value.key : freshKey();
  const blocked = Array.isArray(value.blocked) ? value.blocked.filter(isBlockedPerson).slice(0, BLOCKED_KEEP) : [];
  const reports = Array.isArray(value.reports) ? value.reports.filter(isPersonReport).slice(0, PERSON_REPORTS_KEEP) : [];
  return { key, blocked, reports };
}

const reasonLabel = (reason: PersonReportReason) => PERSON_REPORT_REASONS.find(item => item.id === reason)?.label ?? reason;

/** The email to the developer, in English (the developer reads it). Short, so mail apps take the link. */
export function buildPersonReportMail(
  to: string,
  report: PersonReport,
  info: { appName: string; appVersion: string; platform: string; language: string },
): { url: string; subject: string; body: string } {
  const subject = `${info.appName}: Play together report (${reasonLabel(report.reason)})`;
  const body = [
    'I am reporting someone I played with in Play together.',
    '',
    `Reason: ${reasonLabel(report.reason)}`,
    `Their name in the room: ${report.name || '(none)'}`,
    `Activity: ${report.activity}`,
    `Note: ${clip(report.note, 400) || '(none)'}`,
    `Reported at: ${new Date(report.createdAt).toISOString()}`,
    `App version: ${info.appVersion}`,
    `Platform: ${info.platform}`,
    `Language: ${info.language}`,
    `Report ID: ${report.id}`,
  ].join('\n');
  return { url: `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, subject, body };
}
