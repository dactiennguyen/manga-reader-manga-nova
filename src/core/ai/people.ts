import { msg, t } from '../i18n';
import { LIMITS } from '../model/constants';
import type { Character, CharacterRole, WorldType } from '../model/types';
import { AiError, type AiMessage } from './port';
import { askJson } from './story';

export type CharacterDraft = Pick<
  Character,
  'name' | 'role' | 'age' | 'gender' | 'traits' | 'goal' | 'weakness' | 'voice' | 'bio' | 'appearance'
>;

export type PlotHole = { issue: string; suggestion: string; chapter: string };

const EDITOR =
  'You are a manga story editor helping an author with their own story. Write in the same language as the author. Answer with JSON only: no markdown fences, no commentary.';

const ROLES: CharacterRole[] = ['main', 'support', 'villain', 'extra'];
const FORMAT_ERROR = msg('The AI answer was not in the expected format. Try again.');

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max).trim() : '';
}

function long(value: unknown, max: number): string {
  return typeof value === 'string'
    ? value
        .replace(/[ \t]+/g, ' ')
        .trim()
        .slice(0, max)
        .trim()
    : '';
}

function field(value: unknown, key: string): unknown {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
}

export function parseCharacterDraft(value: unknown): CharacterDraft {
  const name = text(field(value, 'name'), LIMITS.characterName);
  if (!name) {
    throw new AiError('format', t(FORMAT_ERROR));
  }
  const rawRole = text(field(value, 'role'), 12).toLowerCase();
  const rawTraits = field(value, 'traits');
  const traits = (Array.isArray(rawTraits) ? rawTraits : typeof rawTraits === 'string' ? rawTraits.split(/[,，]/) : [])
    .map(item => text(item, 24))
    .filter(Boolean)
    .slice(0, LIMITS.characterTraits);
  return {
    name,
    role: ROLES.find(role => role === rawRole) ?? 'support',
    age: text(field(value, 'age'), 12),
    gender: text(field(value, 'gender'), 20),
    traits,
    goal: text(field(value, 'goal'), 200),
    weakness: text(field(value, 'weakness'), 200),
    voice: text(field(value, 'voice'), 200),
    bio: long(field(value, 'bio'), LIMITS.bio),
    appearance: long(field(value, 'appearance'), LIMITS.appearance),
  };
}

function characterMessages(brief: string, keywords: string): AiMessage[] {
  return [
    { role: 'system', content: EDITOR },
    {
      role: 'user',
      content: `${brief}\n\nCreate a character for this story from these keywords: ${keywords}\n\nReturn {"name": string (max ${LIMITS.characterName} characters), "role": "main" | "support" | "villain" | "extra", "age": short string, "gender": string, "traits": 3 to 6 short keywords, "goal": one sentence, "weakness": one sentence, "voice": how they talk in one sentence, "bio": 2 to 4 sentences of backstory, "appearance": hair, eyes, build, clothes and a distinguishing mark in 2 to 3 sentences}.`,
    },
  ];
}

function worldMessages(brief: string, type: WorldType, title: string, existing: string): AiMessage[] {
  return [
    { role: 'system', content: EDITOR },
    {
      role: 'user',
      content: `${brief}\n\nWrite the wiki entry "${title}" (type: ${type}) for this story's world.${
        existing ? ` The author already wrote this, keep what fits:\n${existing}` : ''
      }\n\nReturn {"body": 2 to 4 short paragraphs of plain text, concrete details the author can use in scenes, no headings}.`,
    },
  ];
}

export function parseWorldBody(value: unknown): string {
  const body = long(field(value, 'body'), 2000);
  if (!body) {
    throw new AiError('format', t(FORMAT_ERROR));
  }
  return body;
}

function plotHoleMessages(brief: string): AiMessage[] {
  return [
    { role: 'system', content: EDITOR },
    {
      role: 'user',
      content: `${brief}\n\nRead the outline and characters and list the problems a careful editor would raise: contradictions, threads that are set up and never paid off, characters without a clear motive, missing stakes. 2 to 6 items, most important first. If the outline is too thin to judge, say what is missing.\n\nReturn {"issues": [{"issue": one sentence, "suggestion": one sentence on how to fix it, "chapter": the chapter title it concerns or "" }]}.`,
    },
  ];
}

export function parsePlotHoles(value: unknown): PlotHole[] {
  const source = Array.isArray(value)
    ? value
    : Array.isArray(field(value, 'issues'))
    ? (field(value, 'issues') as unknown[])
    : [];
  const issues = source
    .map(item => ({
      issue: text(field(item, 'issue'), 240),
      suggestion: text(field(item, 'suggestion'), 240),
      chapter: text(field(item, 'chapter'), LIMITS.chapterTitle),
    }))
    .filter(item => item.issue);
  if (!issues.length) {
    throw new AiError('format', t(FORMAT_ERROR));
  }
  return issues.slice(0, 6);
}

export async function suggestCharacter(brief: string, keywords: string, signal?: AbortSignal) {
  return askJson(characterMessages(brief, keywords), parseCharacterDraft, signal);
}

export async function describeWorldEntry(
  brief: string,
  type: WorldType,
  title: string,
  existing: string,
  signal?: AbortSignal,
) {
  return askJson(worldMessages(brief, type, title, existing), parseWorldBody, signal);
}

export async function findPlotHoles(brief: string, signal?: AbortSignal) {
  return askJson(plotHoleMessages(brief), parsePlotHoles, signal);
}
