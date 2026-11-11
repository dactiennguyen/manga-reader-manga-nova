import { msg } from '../i18n';
import { takeChars } from '../util/format';

/**
 * Reports on AI answers, for Google Play's rule on AI-generated content: a person can flag an answer
 * without leaving the app. Reports are kept on the device, and can also go to the developer by email
 * when SUPPORT_EMAIL is set in core/model/constants.
 */

export type ReportReason = 'offensive' | 'sexual' | 'violent' | 'wrong' | 'other';

/** Where the answer was shown. Stored, so a name never changes once shipped. */
export type AiFeature =
  | 'assistant'
  | 'script'
  | 'plotIdeas'
  | 'sceneIdeas'
  | 'plotHoles'
  | 'character'
  | 'world'
  | 'translation'
  | 'storyIdea';

export const REPORT_REASONS: readonly { id: ReportReason; label: string }[] = [
  { id: 'offensive', label: msg('Offensive or hateful') },
  { id: 'sexual', label: msg('Sexual content') },
  { id: 'violent', label: msg('Violent or dangerous') },
  { id: 'wrong', label: msg('Wrong or misleading') },
  { id: 'other', label: msg('Other') },
];

export const AI_FEATURE_LABEL: Record<AiFeature, string> = {
  assistant: msg('Assistant chat'),
  script: msg('AI writing help'),
  plotIdeas: msg('AI plot ideas'),
  sceneIdeas: msg('Break into scenes'),
  plotHoles: msg('Find plot holes'),
  character: msg('Fill with AI'),
  world: msg('Write with AI'),
  translation: msg('Translate with AI'),
  storyIdea: msg('AI story suggestion'),
};

export type AiReport = {
  id: string;
  feature: AiFeature;
  reason: ReportReason;
  note: string;
  /** The answer as the AI wrote it, shortened to REPORT_TEXT_MAX. */
  text: string;
  /** The chat message, so the chat can fold a reported answer away. */
  answerId?: string;
  createdAt: number;
};

export type ReportInput = Omit<AiReport, 'id' | 'createdAt'>;

export const REPORT_NOTE_MAX = 500;
/** Enough to see what was wrong; kept short since every report is saved with the others in one record. */
export const REPORT_TEXT_MAX = 1500;
/** Mail apps and intents cut long mailto links, so the answer in the email is shorter. */
export const MAIL_TEXT_MAX = 1200;
/**
 * The longest mailto link built. Non-Latin text grows up to 9 times when encoded (one character becomes
 * %XX%XX%XX), so the answer is shortened until the encoded link fits, not by its character count alone.
 */
export const MAIL_URL_MAX = 4000;
export const REPORTS_KEEP = 200;

const REASONS = new Set<string>(REPORT_REASONS.map(item => item.id));
const FEATURES = new Set<string>(Object.keys(AI_FEATURE_LABEL));

/** Cuts by characters, not UTF-16 units, so an emoji is never split into a broken half. */
export function clip(text: string, max: number): string {
  if (max <= 0) {
    return '';
  }
  return Array.from(text).length > max ? `${takeChars(text, max - 1)}…` : text;
}

/** Builds a report from what the sheet collected. */
export function makeReport(input: ReportInput, id: string, now: number): AiReport {
  const report: AiReport = {
    id,
    feature: input.feature,
    reason: input.reason,
    note: clip(input.note.trim(), REPORT_NOTE_MAX),
    text: clip(input.text.trim(), REPORT_TEXT_MAX),
    createdAt: now,
  };
  if (input.answerId) {
    report.answerId = input.answerId;
  }
  return report;
}

/** Newest first, and only the latest REPORTS_KEEP. */
export function withReport(list: readonly AiReport[], report: AiReport): AiReport[] {
  return [report, ...list.filter(item => item.id !== report.id)].slice(0, REPORTS_KEEP);
}

function isReport(value: unknown): value is AiReport {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.text === 'string' &&
    typeof item.note === 'string' &&
    typeof item.createdAt === 'number' &&
    typeof item.reason === 'string' &&
    REASONS.has(item.reason) &&
    typeof item.feature === 'string' &&
    FEATURES.has(item.feature) &&
    (item.answerId === undefined || typeof item.answerId === 'string')
  );
}

/** Reads the saved list. Anything broken or unknown is dropped rather than crashing the app. */
export function parseReports(raw: string | null | undefined): AiReport[] {
  if (!raw) {
    return [];
  }
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter(isReport).slice(0, REPORTS_KEEP) : [];
  } catch {
    return [];
  }
}

export type ReportMail = { url: string; subject: string; body: string };

const reasonLabel = (reason: ReportReason) => REPORT_REASONS.find(item => item.id === reason)?.label ?? reason;

/**
 * The email to the developer. It is written in English whatever the app language, because the developer
 * reads it. The answer is shortened so the mailto link stays within what mail apps accept.
 */
export function buildReportMail(
  to: string,
  report: AiReport,
  info: { appName: string; appVersion: string; platform: string; language: string },
): ReportMail {
  const subject = `${info.appName}: AI answer report (${reasonLabel(report.reason)})`;
  const lines = [
    'I am reporting an AI answer from the app.',
    '',
    `Reason: ${reasonLabel(report.reason)}`,
    `Feature: ${AI_FEATURE_LABEL[report.feature]}`,
    `Note: ${clip(report.note, 150) || '(none)'}`,
    `Reported at: ${new Date(report.createdAt).toISOString()}`,
    `App version: ${info.appVersion}`,
    `Platform: ${info.platform}`,
    `Language: ${info.language}`,
    `Report ID: ${report.id}`,
    '',
    'AI answer:',
  ];
  const build = (answerChars: number) => {
    const body = [...lines, clip(report.text, answerChars)].join('\n');
    return { url: `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, subject, body };
  };
  // The longest answer whose link still fits (the rest of the body is short and bounded).
  let low = 0;
  let high = Math.min(MAIL_TEXT_MAX, Array.from(report.text).length);
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (build(mid).url.length <= MAIL_URL_MAX) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return build(low);
}
