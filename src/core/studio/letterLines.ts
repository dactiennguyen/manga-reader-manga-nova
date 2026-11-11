/**
 * Letters from the reading club, each written by one member in their own voice.
 * Placeholders: {story} {n} {name} {pages} {level} {count}.
 */
import { msg } from '../i18n';
import type { CastId } from './types';

export type LetterLine = { from: Exclude<CastId, 'mori'>; subject: string; body: string };

const l = (from: LetterLine['from'], subject: string, body: string): LetterLine => ({ from, subject, body });

export const FIRST_PAGE_LETTERS: LetterLine[] = [
  l('mai', msg('Your first page!'), msg("I saw your very first finished page! It's so cool. I gave it a gold star in my head. Please make more!")),
  l(
    'hana',
    msg('A first page to remember'),
    msg('Your first finished page of {story} made my day. I can already tell this story will be special. I will be waiting for the next one.'),
  ),
  l('rin', msg('Page one, done'), msg("I made tea and read your first finished page slowly. Every series starts exactly like this. I'm glad I was here for it.")),
];

/** One per member: the chapter letter comes from whoever liked the chapter most. */
export const CHAPTER_LETTERS: LetterLine[] = [
  l('hana', msg('Chapter {n} made me smile'), msg("I just finished chapter {n} of {story} and I'm still smiling. {name} was wonderful. Thank you for all {pages}!")),
  l('kenta', msg('Chapter {n} was EPIC'), msg("Chapter {n} is DONE and it was awesome!! I read it three times. When's the next one?? I'm ready!!")),
  l('aiko', msg('Notes on chapter {n}'), msg('I finished chapter {n} and went back to check a few details. They held up. I have theories now, so please keep going.')),
  l('daichi', msg('About chapter {n}'), msg("Chapter {n} is finished. That takes real discipline. It's honest work, and it shows. Looking forward to the next one.")),
  l('mai', msg('I read chapter {n}!'), msg('I read all of chapter {n}! My favourite was {name}. I tried to draw {name} too, but yours is better. Please make another chapter!')),
  l('minh', msg('Chapter {n}: binged'), msg('Read chapter {n} in one sitting. That last page got me. How long until the next one? Asking for myself.')),
  l('linh', msg('Your layouts in chapter {n}'), msg('I studied the pages of chapter {n} like homework. Your panel flow is getting confident. Keep trusting your eye.')),
  l('sora', msg('The world of {story}'), msg("Chapter {n} made the world of {story} feel bigger. I keep wondering what's past the edge of the page. Show me someday?")),
  l(
    'tetsu',
    msg('A chapter well finished'),
    msg("Chapter {n}, every page done. I've read manga for fifty years, and finishing is what turns a dreamer into a mangaka. Well done."),
  ),
  l('yui', msg('{name} in chapter {n}'), msg('I keep thinking about {name} after chapter {n}. They felt like a real person. Please give them a happy moment soon.')),
  l('bao', msg('Chapter {n}... brr'), msg("I finished chapter {n} late at night. Bad idea, great chapter. Now I'm checking under my bed. Thanks a lot.")),
  l('rin', msg('A cozy read'), msg('I saved chapter {n} for a quiet evening and it was perfect. Thank you for making something so warm. Rest a little before the next one.')),
];

export const STREAK_7_LETTERS: LetterLine[] = [
  l('kenta', msg('7 days straight!!'), msg("Seven days in a row!! That's a training arc! Keep it up and you'll unlock a new power for sure!")),
  l('minh', msg('A week-long streak'), msg("Seven days of drawing in a row. That's the rhythm of a weekly series. You're basically a pro now.")),
  l('rin', msg('Seven days'), msg("A whole week of drawing every day. What a lovely habit. Don't forget to rest your hand with a warm drink.")),
];

export const STREAK_30_LETTERS: LetterLine[] = [
  l('tetsu', msg('Thirty days'), msg('Thirty days in a row at the desk. The greats I grew up with worked like this. You have my respect, young one.')),
  l('daichi', msg('A month of work'), msg('A month without missing a day. Talent is nice, but this is what actually finishes stories. Respect.')),
  l('sora', msg('A month-long journey'), msg('Thirty days! In a fantasy story, this is where the hero comes home changed. I think you have.')),
];

export const LEVEL_LETTERS: LetterLine[] = [
  l('yui', msg('Congratulations!'), msg("You reached {level} on your journey! I told the whole club. We're all cheering for you.")),
  l('aiko', msg('Level up: {level}'), msg('I noticed you reached {level}. Logical, given how much you have been working. I predict the next level soon.')),
  l('linh', msg('Moving up'), msg('{level}! Your pages show the progress too. Keep sketching a little every day.')),
  l('hana', msg('You leveled up!'), msg("{level}! I'm so happy for you. Please treat yourself to something sweet today.")),
  l('tetsu', msg('A new rank'), msg("{level}. In my day we'd call that a promotion. Don't let it go to your head. Keep drawing.")),
];

export const FIRST_CHARACTER_LETTERS: LetterLine[] = [
  l('yui', msg('Meet {name}'), msg('You made {name}! I already want to know everything about them. What do they eat for breakfast? What makes them cry?')),
  l('hana', msg('Hello, {name}'), msg("{name} sounds like someone I'd cheer for. I can't wait to see them on the page.")),
  l('sora', msg('A new hero appears'), msg("{name} has stepped into {story}! Every legend starts with one name. I'm excited to see where they go.")),
];

export const STORY_DONE_LETTERS: LetterLine[] = [
  l('tetsu', msg('{story}: complete'), msg("You finished {story}. A whole story, start to end. Few ever do that. I'm proud to have read it.")),
  l(
    'rin',
    msg('The last page'),
    msg("I read the last page of {story} and just sat quietly for a while. Thank you for this story. Rest, then start a new one when you're ready."),
  ),
  l('daichi', msg('On finishing {story}'), msg('{story} is finished. Real endings are hard, and you made one. That counts for a lot.')),
];
