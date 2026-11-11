/** What Mori, the editor, says in each situation. Placeholders: {story} {name} {n} {pages} {finished} {days} {count} {best} {level}. */
import { msg } from '../i18n';
import type { EditorSituation } from './types';

export const EDITOR_LINES: Record<EditorSituation, string[]> = {
  welcome: [
    msg("Hello, I'm Mori, your editor. Whenever you're ready, start a story and I'll read every page."),
    msg('Every great series started as one blank page. Shall we make yours?'),
    msg("I'm Mori, your editor here. Bring me any idea, even a tiny one. We'll grow it together."),
    msg('No story yet? Perfect. A clean desk is the best kind. Start with a title and one character.'),
  ],
  absence: [
    msg("Welcome back! It's been {days} days. {story} kept your seat warm."),
    msg('{days} days away. I hope you rested well. One small page today is plenty for {story}.'),
    msg('There you are! {story} has been waiting {days} days. Even five minutes counts.'),
    msg("I kept your desk exactly as you left it. Let's ease back in with something small."),
  ],
  levelUp: [
    msg("A new level: {level}! I knew you had it in you. Let's celebrate with one more page."),
    msg('Congratulations on reaching {level}. The red pen stays in my pocket today.'),
    msg('You moved up a level on your journey. Take a moment to enjoy it. You earned it.'),
    msg("{level}! I'm framing this one in my head. Ready for the next step?"),
  ],
  streakRisk: [
    msg('{count} days in a row so far. A single line today keeps the streak alive.'),
    msg("Your streak is at {count} days. Don't let it slip; even a quick sketch counts."),
    msg('A quick note from your editor: no drawing yet today, and a {count}-day streak is on the line.'),
    msg('Busy day? Draw one panel of {name} and the {count}-day streak lives on.'),
  ],
  streakKept: [
    msg("{count} days in a row! That's how series get finished. I'm proud of you."),
    msg('Day {count} of your streak. Your lines are getting surer, I can tell.'),
    msg('A {count}-day streak. Keep this rhythm and the pages will add up on their own.'),
    msg('{count} days straight at the desk. Remember to stretch your drawing hand!'),
  ],
  streakBroken: [
    msg('Streaks break, and that is fine. Your best was {best} days, and you can beat it starting today.'),
    msg('Fresh start today. One small drawing begins a new streak.'),
    msg('Even pros miss days. Your record of {best} days is still yours. Shall we start a new one?'),
  ],
  chapterDone: [
    msg("Chapter {n} is finished! I read it twice. Take a breath, then let's talk about what's next."),
    msg('You finished chapter {n} of {story}. That is a real milestone, not a small one.'),
    msg('Chapter {n}: done. The reading club is going to have opinions, I am sure.'),
    msg('Every page of chapter {n} is done. Have a snack. The next chapter will wait for you.'),
  ],
  storyDone: [
    msg('{story} is complete. A whole story, from first idea to last page. Thank you for letting me edit it.'),
    msg('You finished {story}! Whenever you feel ready, a new idea is welcome on my desk.'),
    msg('{story} is done. Export it, show it to someone you trust, and be proud.'),
  ],
  flagged: [
    msg("Chapter {n} has {pages} flagged. Let's fix those first; the rest will feel easier."),
    msg('I left sticky notes on {pages} in chapter {n}. Nothing scary, just a few touch-ups.'),
    msg('Before new pages, a little cleanup: {pages} flagged in chapter {n}.'),
    msg('Fixing the flagged pages in chapter {n} now saves headaches later. {pages} to go.'),
  ],
  noChapters: [
    msg("{story} has no chapters yet. Let's sketch an outline; it is the map for everything after."),
    msg('Before pages come chapters. Plan a few for {story}; they can change later.'),
    msg("Tell me how {story} begins and ends, and we'll split the middle into chapters together."),
  ],
  noScript: [
    msg('Chapter {n} is still a blank script. Start with the first thing {name} says.'),
    msg("What happens in chapter {n}? Write it messy; we'll tidy it up later."),
    msg('A script is just people talking and doing things. Give chapter {n} its first scene.'),
    msg("Let's write chapter {n} of {story}. One scene is a great start."),
  ],
  scriptNoPages: [
    msg('The chapter {n} script reads well. Time to split it into pages and see it as manga.'),
    msg('Chapter {n} has words. Now it needs panels. Shall we paginate?'),
    msg('Your script for chapter {n} is waiting to become pages. This is the fun part.'),
    msg("I marked up the chapter {n} script. Lightly! Now let's turn it into pages."),
  ],
  pagesLeft: [
    msg("Chapter {n}: {pages} to go. One at a time, that's how it's done."),
    msg("{finished} of chapter {n} done, {pages} left. You're closer than it feels."),
    msg('{name} is waiting on the next page of chapter {n}. Only {pages} left.'),
    msg('Small steps: finish a single panel today. Chapter {n} has {pages} left.'),
    msg("I'd love to read the rest of chapter {n}. {pages} left. No rush, but I'm curious."),
    msg('Today, just one page of chapter {n}. Tomorrow, maybe another. {pages} left.'),
  ],
  allDone: [
    msg('Every page of {story} is done. Preview it once with fresh eyes, then export!'),
    msg('Nothing left to draw in {story}. Read it start to finish, the way a reader would.'),
    msg('All pages done. My only note: export it and show someone.'),
    msg("{story} is ready to print. I'm a little emotional, honestly."),
  ],
};
