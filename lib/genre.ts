import type { PlaylistTrackView } from "./types";

/** Gêneros reconhecidos na UI de agrupamento. */
export type MusicGenre =
  | "Gospel"
  | "Trap"
  | "Rap"
  | "Funk"
  | "Sertanejo"
  | "Pagode"
  | "Forró"
  | "MPB"
  | "Rock"
  | "Pop"
  | "Eletrônica"
  | "R&B"
  | "Reggae"
  | "Outros";

export interface GenreGroup<T = PlaylistTrackView> {
  genre: MusicGenre;
  tracks: T[];
}

/** Ordem de exibição dos accordions (Outros sempre por último). */
export const MUSIC_GENRES: MusicGenre[] = [
  "Pop",
  "Rap",
  "Trap",
  "Funk",
  "Gospel",
  "Sertanejo",
  "Pagode",
  "Forró",
  "MPB",
  "Rock",
  "Eletrônica",
  "R&B",
  "Reggae",
  "Outros",
];

const GENRE_ORDER = MUSIC_GENRES;

const GENRE_SET = new Set<string>(GENRE_ORDER);

export function isMusicGenre(value: string): value is MusicGenre {
  return GENRE_SET.has(value);
}

/** Regras: a primeira que casar vence (Trap antes de Rap, etc.). */
const RULES: Array<{ genre: MusicGenre; patterns: RegExp[] }> = [
  {
    genre: "Gospel",
    patterns: [
      /\bgospel\b/i,
      /\blouvor\b/i,
      /\badora[cç][aã]o\b/i,
      /\bworship\b/i,
      /\bhillsong\b/i,
      /\bfernandinho\b/i,
      /\baisha\b/i,
      /\bgabriel\s+guedes\b/i,
      /\bisaias\s+saad\b/i,
      /\bmariana\s+valad[aã]o\b/i,
      /\bharpa\s+crist[aã]\b/i,
    ],
  },
  {
    genre: "Trap",
    patterns: [
      /\btrap\b/i,
      /\bmatu[eê]\b/i,
      /\bwiu\b/i,
      /\bveigh\b/i,
      /\bkayblack\b/i,
      /\bchefin\b/i,
      /\borochi\b/i,
    ],
  },
  {
    genre: "Rap",
    patterns: [
      /\brap\b/i,
      /\bhip[\s-]?hop\b/i,
      /\bemcee\b/i,
      /\brappers?\b/i,
      /\bemicida\b/i,
      /\bracionais\b/i,
      /\bcriolo\b/i,
      /\bdjonga\b/i,
      /\bkarynne\b/i,
      /\bblack\s+alien\b/i,
    ],
  },
  {
    genre: "Funk",
    patterns: [
      /\bfunk\b/i,
      /\bmc\s+kevin/i,
      /\banitta\b/i,
      /\bludmilla\b/i,
      /\bpedro\s+sampaio\b/i,
      /\bdennis\s+dj\b/i,
      /\bconduta\b/i,
      /\bbatid[aã]o\b/i,
    ],
  },
  {
    genre: "Sertanejo",
    patterns: [
      /\bsertanejo\b/i,
      /\bcountry\b/i,
      /\bjorge\s*&\s*mateus\b/i,
      /\bhenrique\s*&\s*juliano\b/i,
      /\bmar[ií]lia\s+mendon[cç]a\b/i,
      /\bgusttavo\s+lima\b/i,
      /\bluan\s+santana\b/i,
      /\bz[eé]\s+neto\b/i,
      /\banaju\b/i,
      /\bmoda\b/i,
    ],
  },
  {
    genre: "Pagode",
    patterns: [
      /\bpagode\b/i,
      /\bsamba\b/i,
      /\bthiaguinho\b/i,
      /\bp[eé]ricles\b/i,
      /\bgrupo\s+menos\s+[eé]\s+mais\b/i,
      /\bdilsinho\b/i,
    ],
  },
  {
    genre: "Forró",
    patterns: [
      /\bforr[oó]\b/i,
      /\bxote\b/i,
      /\bwesley\s+safad[aã]o\b/i,
      /\bavine\s+vinny\b/i,
      /\bjo[aã]o\s+gomes\b/i,
    ],
  },
  {
    genre: "MPB",
    patterns: [
      /\bmpb\b/i,
      /\bbossa\b/i,
      /\bcaetano\b/i,
      /\bgilberto\s+gil\b/i,
      /\bchico\s+buarque\b/i,
      /\bdjavan\b/i,
      /\belis\s+regina\b/i,
    ],
  },
  {
    genre: "Rock",
    patterns: [
      /\brock\b/i,
      /\bmetal\b/i,
      /\bpunk\b/i,
      /\bgrunge\b/i,
      /\bindie\b/i,
      /\balternative\b/i,
      /\blegiao\b/i,
      /\blegi[aã]o\s+urbana\b/i,
      /\bcharlie\s+brown\b/i,
      /\bnirvana\b/i,
      /\bfoo\s+fighters\b/i,
      /\bred\s+hot\b/i,
    ],
  },
  {
    genre: "Eletrônica",
    patterns: [
      /\belectro(?:nic)?\b/i,
      /\bedm\b/i,
      /\bhouse\b/i,
      /\btechno\b/i,
      /\bdubstep\b/i,
      /\btrance\b/i,
      /\bdj\b/i,
      /\balok\b/i,
      /\bvintage\s+culture\b/i,
      /\bcalvin\s+harris\b/i,
    ],
  },
  {
    genre: "R&B",
    patterns: [
      /\br\s*&\s*b\b/i,
      /\brnb\b/i,
      /\bsoul\b/i,
      /\bneo[\s-]?soul\b/i,
      /\bthe\s+weeknd\b/i,
      /\bfrank\s+ocean\b/i,
    ],
  },
  {
    genre: "Reggae",
    patterns: [
      /\breggae\b/i,
      /\bdancehall\b/i,
      /\bbob\s+marley\b/i,
      /\bnatiruts\b/i,
      /\bplanta\s*&\s*raiz\b/i,
    ],
  },
  {
    genre: "Pop",
    patterns: [
      /\bpop\b/i,
      /\bk[\s-]?pop\b/i,
      /\btaylor\s+swift\b/i,
      /\bariana\s+grande\b/i,
      /\bbillie\s+eilish\b/i,
      /\bdua\s+lipa\b/i,
      /\blady\s+gaga\b/i,
      /\bjustin\s+bieber\b/i,
      /\bharry\s+styles\b/i,
      /\blu[ií]sa\s+sonza\b/i,
      /\bj[aã]o\b/i,
      /\bmanu\s+gavassi\b/i,
    ],
  },
];

function normalizeHaystack(title: string, artist: string): string {
  return `${title} ${artist}`.normalize("NFD").replace(/\p{M}/gu, "");
}

export function classifyGenre(title: string, artist: string): MusicGenre {
  const hay = normalizeHaystack(title, artist);
  for (const rule of RULES) {
    if (rule.patterns.some((re) => re.test(hay))) {
      return rule.genre;
    }
  }
  return "Outros";
}

/** Prefere gênero persistido; senão classifica por título/artista. */
export function trackGenreOf(track: {
  title: string;
  artist: string;
  genre?: string | null;
}): MusicGenre {
  if (track.genre && isMusicGenre(track.genre)) return track.genre;
  return classifyGenre(track.title, track.artist);
}

export function groupTracksByGenre<
  T extends { title: string; artist: string; genre?: string | null },
>(tracks: T[]): GenreGroup<T>[] {
  const buckets = new Map<MusicGenre, T[]>();

  for (const track of tracks) {
    const genre = trackGenreOf(track);
    const list = buckets.get(genre);
    if (list) list.push(track);
    else buckets.set(genre, [track]);
  }

  const groups: GenreGroup<T>[] = [];
  for (const genre of GENRE_ORDER) {
    const list = buckets.get(genre);
    if (list && list.length > 0) {
      groups.push({ genre, tracks: list });
    }
  }
  return groups;
}

/** Lista plana na ordem dos grupos (para playback / índice). */
export function flattenGenreGroups<
  T extends { title: string; artist: string; genre?: string | null },
>(tracks: T[]): T[] {
  return groupTracksByGenre(tracks).flatMap((g) => g.tracks);
}
