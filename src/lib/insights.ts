/* Helpers shared by pages. The decision rules themselves live in insightRules.ts. */

type Item = { name: string; hours: number; people: number; category: string };

/** Unproductive items that are probably work tools: not a non-work category, used by several people. */
export function misTagCandidates(unprod: Item[], nonWorkCats: string[], minPeople = 3) {
  return unprod.filter((u) => !nonWorkCats.includes(u.category) && u.people >= minPeople && !/news|msn/i.test(u.category + u.name));
}
