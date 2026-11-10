import { DAILY_TIPS, GENRES } from '../model/constants';
import { msg, t } from '../i18n';
import { DAY_MS, dayKeyToDate } from '../util/time';

/** One sample idea per genre, in the order of GENRES. */
const IDEAS = [
  msg('A blind swordsman must protect a child who bears the mark of his old enemy.'),
  msg('Two sisters row out to find an island that only appears on moonless nights.'),
  msg('Two strangers trade letters through a library desk drawer without ever meeting.'),
  msg('A retired demon king opens a noodle shop, and the hero keeps eating on credit.'),
  msg('An old apartment block grows one extra floor every time the power goes out.'),
  msg('A club about to be shut down has three members left and a secret in the storeroom.'),
  msg('A mail boy works in a kingdom where every letter is a living creature.'),
  msg("A robot mechanic finds an old machine that still holds her mother's memories."),
  msg('A bike repair shop at the end of an alley, and the visitors each rainy season brings.'),
  msg('A student detective receives a riddle letter signed in his own handwriting.'),
  msg('A fishing village volleyball team travels to the city for its first tournament.'),
  msg('A young papermaker unknowingly keeps the map the whole capital is hunting for.'),
];

const DEFAULT_IDEA_INDEXES = [1, 5, 6];

export function pickIdeas(favorites: string[]): string[] {
  const genres: readonly string[] = GENRES;
  const indexes = [...favorites.map(genre => genres.indexOf(genre)), ...DEFAULT_IDEA_INDEXES];
  return indexes
    .filter((value, index, all) => value >= 0 && all.indexOf(value) === index)
    .flatMap(index => IDEAS[index] ?? [])
    .slice(0, 3)
    .map(idea => t(idea));
}

export function tipOfDay(day: string): string {
  return t(DAILY_TIPS[Math.floor(dayKeyToDate(day).getTime() / DAY_MS) % DAILY_TIPS.length] ?? DAILY_TIPS[0]);
}
