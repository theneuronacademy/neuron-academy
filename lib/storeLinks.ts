// Which exam page(s) a store item belongs with, judged from its title.
// Used to link exam pages and their study material to each other, so
// visitors (and search engines) can get from one to the other.

const EXAM_MATCHERS: Array<{ slug: string; test: (t: string) => boolean }> = [
  { slug: "jmi-entrance", test: (t) => /\bjmi\b|jamia/i.test(t) },
  { slug: "amu-entrance", test: (t) => /\bamu\b|aligarh/i.test(t) },
  { slug: "cm-shri-entrance", test: (t) => /cm[\s-]*shri/i.test(t) },
  { slug: "class-10-cbse", test: (t) => /cbse/i.test(t) && /class[\s-]*(10|x)(th)?\b/i.test(t) },
  { slug: "neet", test: (t) => /\bneet\b/i.test(t) },
  { slug: "jee", test: (t) => /\bjee\b/i.test(t) },
];

/** Exam page slugs whose exam is named in this item's title. */
export function examSlugsForTitle(title: string): string[] {
  return EXAM_MATCHERS.filter((m) => m.test(title)).map((m) => m.slug);
}

/** The items that belong on one exam page. */
export function itemsForExam<T extends { title: string }>(items: T[], slug: string): T[] {
  return items.filter((i) => examSlugsForTitle(i.title).includes(slug));
}
