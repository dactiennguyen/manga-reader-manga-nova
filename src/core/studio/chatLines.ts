/**
 * What the person's own characters say to them, in first person and under 140 characters.
 * Placeholders: {story} {other} {goal} {weakness} {n} {days}.
 */
import { msg } from '../i18n';
import type { CharacterRole } from '../model/types';
import type { TraitKind } from './traits';

export const ROLE_LINES: Record<CharacterRole, string[]> = {
  main: [
    msg("Hey, it's me. The main character. Just checking we're still on for today?"),
    msg("I've been practicing my big entrance. Draw me soon?"),
    msg('Everyone keeps looking at me for what to do next. Any hints?'),
    msg("Main character, reporting for duty. Let's get {story} moving!"),
    msg('I had a dream about the ending of {story}. I will tell you if you draw the next page.'),
    msg('Can I have a cooler pose this time? Asking for a friend. The friend is me.'),
  ],
  support: [
    msg("Not to complain, but I've got lines too, you know."),
    msg("I'm always helping {other}. Who's helping me? You, I hope."),
    msg('Quick idea: what if I saved the day in the next chapter? Just saying.'),
    msg('I packed snacks for the next scene. Ready when you are.'),
    msg('Behind every hero is someone like me, holding the map.'),
    msg('Psst. I know a secret about {other}. Want to write it in?'),
  ],
  villain: [
    msg("Ahem. I've been very patient. My evil plan needs its next page."),
    msg("You can't keep me in the shadows forever. Well, you can. But don't."),
    msg('I polished my evil laugh. Give me a panel to use it in.'),
    msg('{other} thinks they have won. Ha. Ha ha. Let us prove them wrong.'),
    msg('Villains need love too. Mostly in the form of dramatic lighting.'),
    msg('My scheme is perfect. It only needs you to draw it.'),
  ],
  extra: [
    msg("Hi! I'm in the background, but I wave a lot. Did you notice?"),
    msg('Could I get one line? Even "Look out!" would do.'),
    msg("I've been standing in the same spot since chapter {n}. My legs are tired."),
    msg('Background characters have feelings too. Mine is excitement.'),
    msg("I'll be in the crowd scene. Front row, if you don't mind."),
  ],
};

export const TRAIT_LINES: Record<TraitKind, string[]> = {
  brave: [
    msg("Whatever's coming next, I'm not scared. Draw me charging in!"),
    msg("Give me the toughest scene you've got. I can take it."),
  ],
  shy: [
    msg('Um... hi. I just wanted to say... never mind. Thanks for drawing me.'),
    msg("Could I maybe... have a small scene? Only if it's okay."),
  ],
  funny: [
    msg('I came up with a joke for the next chapter. The punchline needs a panel.'),
    msg('Knock knock. Who is there? Your next page. Get it? ...Draw me.'),
  ],
  cold: [
    msg("I'm not saying I miss being drawn. I'm just... noting it."),
    msg("Hmph. Draw me if you want. I don't care. (I care.)"),
  ],
  kind: [
    msg("Don't push yourself too hard today, okay? Drink some water first."),
    msg('I made tea for everyone in {story}. Come join us when you can.'),
  ],
  smart: [
    msg("I've worked out three ways the next scene could go. Want my notes?"),
    msg('By my calculations, today is an excellent day to draw me.'),
  ],
  lazy: [
    msg("Can my next scene be a nap? I'm very good at naps."),
    msg("No rush. Really. I'll be here. Lying down."),
  ],
  proud: [
    msg("Obviously the next chapter should be about me. It's only logical."),
    msg('Make sure you draw my good side. Both sides are my good side.'),
  ],
  fiery: [
    msg('Why are we waiting?! Next page! Now!'),
    msg("I'm fired up! Give me a scene where I get to shout!"),
  ],
  loyal: [
    msg("Wherever the story goes, I'm with {other}. Always."),
    msg("I'll stick with this story to the last page. Promise."),
  ],
  mysterious: [
    msg('I know something nobody in {story} knows. Not yet.'),
    msg('Maybe I will show my real face in the next chapter. Maybe not.'),
  ],
  clumsy: [
    msg('I tripped over a speech bubble again. Can you fix that?'),
    msg('Oops, I spilled ink on the outline. It looks... artistic?'),
  ],
};

export const GOAL_LINES = [
  msg("My goal hasn't changed: {goal}. Help me get closer today?"),
  msg('Every night I think about it: {goal}. Is today the day?'),
  msg("Not to rush you, but this won't happen by itself: {goal}."),
  msg('One step toward my goal would make my week. ({goal})'),
];

export const WEAKNESS_LINES = [
  msg("Between us: {weakness}. Please don't put that in the next chapter. Or do. It's good drama."),
  msg('Okay, I admit it: {weakness}. Be gentle with me.'),
  msg("My weakness? {weakness}. I'm working on it. Mostly."),
  msg('Everyone has a weak spot. Mine: {weakness}. Use it wisely.'),
];

/** When the chapter the character is in has not been touched for days. */
export const STALE_LINES = [
  msg("It's been {days} days since chapter {n}. Did you forget about me?"),
  msg("{days} days... I've been frozen mid-sentence in chapter {n}!"),
  msg('Still standing where you left me in chapter {n}. {days} days now. Just saying.'),
  msg("Chapter {n} misses you. I miss you. It's been {days} days!"),
  msg("Day {days} of waiting in chapter {n}. I've counted every speech bubble."),
];
