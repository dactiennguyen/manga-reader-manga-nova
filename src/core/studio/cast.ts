/**
 * The editor and the Manganova reading club: named characters of the app, like a mascot. They read the
 * person's own pages on the device. They are never presented as real readers, users or an audience.
 */
import { msg } from '../i18n';
import type { CastId, CastMember } from './types';
import { READER_IDS } from './types';

export const EDITOR: CastMember = {
  id: 'mori',
  name: 'Mori',
  role: msg('Your editor'),
  bio: msg('Mori, 38. Calm, warm and a little dry. Reads every page you make, red pen behind one ear.'),
  tastes: ['drama', 'pacing', 'dialogue'],
  strictness: 2,
};

const CLUB: Record<Exclude<CastId, 'mori'>, CastMember> = {
  hana: {
    id: 'hana',
    name: 'Hana',
    role: msg('Romance and pretty art'),
    bio: msg('Hana, 16. Loves love stories and beautiful pages. Kind to a fault.'),
    tastes: ['romance', 'art'],
    strictness: 1,
  },
  kenta: {
    id: 'kenta',
    name: 'Kenta',
    role: msg('Action fan'),
    bio: msg('Kenta, 14. Lives for fights, speed lines and huge sound effects.'),
    tastes: ['action', 'pacing'],
    strictness: 2,
  },
  aiko: {
    id: 'aiko',
    name: 'Aiko',
    role: msg('Mystery lover'),
    bio: msg('Aiko, 22. Reads mysteries with a notebook and checks that every clue adds up.'),
    tastes: ['mystery', 'dialogue'],
    strictness: 3,
  },
  daichi: {
    id: 'daichi',
    name: 'Daichi',
    role: msg('Drama reader'),
    bio: msg('Daichi, 31. Reads seinen and drama. Wants characters who feel real.'),
    tastes: ['drama', 'dialogue'],
    strictness: 3,
  },
  mai: {
    id: 'mai',
    name: 'Mai',
    role: msg('The youngest reader'),
    bio: msg('Mai, 9. The youngest in the club. Loves funny and cute things.'),
    tastes: ['comedy', 'slice'],
    strictness: 1,
  },
  minh: {
    id: 'minh',
    name: 'Minh',
    role: msg('Webtoon binger'),
    bio: msg('Minh, 19. Binges webtoons and always wants the next chapter right now.'),
    tastes: ['pacing', 'drama'],
    strictness: 2,
  },
  linh: {
    id: 'linh',
    name: 'Linh',
    role: msg('Art student'),
    bio: msg('Linh, 24. Studies art and looks closely at panels and composition.'),
    tastes: ['art', 'pacing'],
    strictness: 2,
  },
  sora: {
    id: 'sora',
    name: 'Sora',
    role: msg('Fantasy fan'),
    bio: msg('Sora, 17. Loves fantasy and big worlds to get lost in.'),
    tastes: ['fantasy', 'art'],
    strictness: 2,
  },
  tetsu: {
    id: 'tetsu',
    name: 'Tetsu',
    role: msg('Reading since the 1970s'),
    bio: msg('Grandpa Tetsu, 68. Has read manga since the 1970s. Strict but fair.'),
    tastes: ['drama', 'action', 'art'],
    strictness: 3,
  },
  yui: {
    id: 'yui',
    name: 'Yui',
    role: msg('Characters and dialogue'),
    bio: msg('Yui, 20. Falls for characters and remembers every good line.'),
    tastes: ['dialogue', 'romance'],
    strictness: 2,
  },
  bao: {
    id: 'bao',
    name: 'Bảo',
    role: msg('Horror fan'),
    bio: msg('Bảo, 13. Loves horror and grins at every scary page.'),
    tastes: ['horror', 'mystery'],
    strictness: 2,
  },
  rin: {
    id: 'rin',
    name: 'Rin',
    role: msg('Cozy stories fan'),
    bio: msg('Rin, 27. Reads slice of life with a mug of tea. Kind and patient.'),
    tastes: ['slice', 'comedy'],
    strictness: 1,
  },
};

export const READERS: CastMember[] = READER_IDS.map(id => CLUB[id as Exclude<CastId, 'mori'>]);

export function castMember(id: CastId): CastMember {
  return id === 'mori' ? EDITOR : CLUB[id];
}
