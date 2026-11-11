/**
 * Words to draw in Guess the drawing: things anyone can sketch in a minute, with a manga flavour. Each
 * key is msg()'d, so the drawer is offered the word in their language. A key or a translation may list
 * other accepted answers after `|`: the first form is the one shown, any form counts as right.
 */
import { msg, t } from '../../../core/i18n';
import type { GuessWord } from '../../../core/nearby/guessSession';

export const GUESS_WORDS: readonly string[] = [
  msg('cat|kitten'),
  msg('dog|puppy'),
  msg('fish'),
  msg('bird'),
  msg('rabbit|bunny'),
  msg('snake'),
  msg('elephant'),
  msg('umbrella'),
  msg('house|home'),
  msg('tree'),
  msg('flower'),
  msg('sun'),
  msg('moon'),
  msg('star'),
  msg('cloud'),
  msg('rainbow'),
  msg('mountain'),
  msg('boat|ship'),
  msg('car'),
  msg('bicycle|bike'),
  msg('train'),
  msg('airplane|plane'),
  msg('rocket'),
  msg('robot'),
  msg('sword'),
  msg('crown'),
  msg('ghost'),
  msg('dragon'),
  msg('castle'),
  msg('book'),
  msg('pencil'),
  msg('glasses'),
  msg('hat'),
  msg('shoe|shoes'),
  msg('guitar'),
  msg('clock'),
  msg('key'),
  msg('cake'),
  msg('apple'),
  msg('pizza'),
  msg('ice cream'),
  msg('ramen|noodles'),
  msg('rice ball|onigiri'),
  msg('lantern'),
  msg('bridge'),
  msg('phone|smartphone'),
  msg('ninja'),
  msg('cherry blossom|sakura'),
];

/** The list in the app's language, read when a turn starts so a language change applies to the next word. */
export function guessWords(): GuessWord[] {
  return GUESS_WORDS.map(key => ({ entry: t(key), english: key }));
}
