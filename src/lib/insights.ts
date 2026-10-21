/* Insights are rules over computed data - wording adapts to any client. */
import type { Insight } from '../components/ui';
import type { Threshold } from '../types';
import { fmtH, fmtN, fmtPct, thresholdText, type GroupStat, type PersonStat } from './metrics';

type Item = { name: string; hours: number; people: number; category: string };

/** Unproductive items that are probably work tools: not a non-work category, used by several people. */
export function misTagCandidates(unprod: Item[], nonWorkCats: string[], minPeople = 3) {
  return unprod.filter((u) => !nonWorkCats.includes(u.category) && u.people >= minPeople && !/news|msn/i.test(u.category + u.name));
}

export function coverageInsight(missingPct: number, unassigned: number, unassignedName?: string): Insight | null {
  if (missingPct < 5 && unassigned === 0) return null;
  return {
    tone: missingPct > 15 ? 'priority' : 'opportunity',
    title: 'Close the presence-coverage gap',
    body: `${fmtPct(missingPct)} of working-day records have no punch or online signal${unassigned ? `, and ${unassigned} people sit in the unassigned "${unassignedName}" group` : ''}. Fixing both sharpens every number below. Hours already ignore these days, so they are not counted as zero.`,
  };
}

export function underTeamsInsight(groups: GroupStat[], t: Threshold, overallPct: number): Insight | null {
  const worst = [...groups].sort((a, b) => b.meetingPct - a.meetingPct).slice(0, 3);
  if (!worst.length) return null;
  const all = worst.filter((g) => g.meetingPct >= 99);
  return {
    tone: 'opportunity',
    title: 'Look at under-utilised teams first',
    body: `${fmtPct(overallPct)} of people average ${thresholdText(t)}. Start with ${worst.map((g) => g.name).join(', ')}${all.length ? `, where ${all.length === worst.length ? 'everyone' : 'almost everyone'} tracked is in that band` : ''}. Check how much of their work happens away from the computer before acting.`,
    link: { page: 'teams', anchor: 'cohorts' },
  };
}

export function redFlagInsight(n: number, ruleText: string): Insight {
  return {
    tone: n > 0 ? 'priority' : 'maintain',
    title: n > 0 ? `Review ${n} red-flag case${n === 1 ? '' : 's'}` : 'No red-flag cases under the current rule',
    body: n > 0
      ? `They meet: ${ruleText}. Confirm role, device and tracking status before drawing any conclusion; treat it as a list for supportive conversations.`
      : `Nobody meets: ${ruleText}. Tighten or add rules on the People page if you expected names here.`,
    link: { page: 'people', anchor: 'redflags' },
  };
}

export function mappingInsight(cands: Item[]): Insight | null {
  if (!cands.length) return null;
  const hrs = cands.reduce((a, c) => a + c.hours, 0);
  return {
    tone: 'priority',
    title: 'Fix the category mapping',
    body: `${fmtN(hrs)} h tagged unproductive sits on items several people use for work: ${cands.slice(0, 3).map((c) => `${c.name} (${fmtN(c.hours)} h, ${c.people} people)`).join('; ')}. Re-tag them if they are work tools.`,
    link: { page: 'apps', anchor: 'urls' },
  };
}

export function nonWorkInsight(sharePct: number, totalHrs: number, heavy: number, heavyCut: number): Insight {
  const small = sharePct < 1;
  return {
    tone: small ? 'maintain' : 'priority',
    title: small ? 'Non-work browsing is not an issue' : 'Non-work browsing needs a policy response',
    body: `${fmtPct(sharePct, 2)} of tracked app time (${fmtN(totalHrs)} h) touched social, video, gaming, gambling or adult sites. ${heavy} people exceed ${heavyCut} h in the period. ${small ? 'No blanket restriction is needed; handle outliers individually.' : 'Consider a reminder of the acceptable-use policy.'}`,
    link: { page: 'apps', anchor: 'screening' },
  };
}

export function aiInsight(adoptionPct: number, nonHubPct: number, perUserMonth: number, hub?: string): Insight {
  const shallow = perUserMonth < 2;
  return {
    tone: shallow ? 'opportunity' : 'maintain',
    title: shallow ? 'Turn broad AI reach into real use' : 'AI usage is healthy - keep it growing',
    body: `${fmtPct(adoptionPct)} touched an AI tool${hub ? ` (${fmtPct(nonHubPct)} excluding ${hub})` : ''}, averaging ${fmtH(perUserMonth)} per user per month. ${shallow ? 'Share power-user practices to deepen usage.' : ''}`,
    link: { page: 'ai', anchor: 'adoption' },
  };
}

export function idleGapInsight(online: number, active: number): Insight {
  return {
    tone: 'opportunity',
    title: 'Use the idle gap as a baseline, not a verdict',
    body: `People are logged in ${fmtH(online)} a day but active for ${fmtH(active)}. Meetings without keyboard input look like idle time - switch on meeting tracking, then check each team against ${fmtH(active)} monthly.`,
    link: { page: 'teams', anchor: 'monthly' },
  };
}

export function trendInsight(series: { month: string; partial: boolean; active: number }[]): Insight | null {
  const full = series.filter((s) => !s.partial);
  if (full.length < 2) return null;
  const a = full[full.length - 2], b = full[full.length - 1];
  const d = b.active - a.active;
  const flat = Math.abs(d) < 0.1;
  return {
    tone: flat ? 'maintain' : d < 0 ? 'priority' : 'maintain',
    title: flat ? 'Activity is steady month to month' : d < 0 ? `Active time fell in ${b.month}` : `Active time rose in ${b.month}`,
    body: `${a.month}: ${fmtH(a.active, 2)} → ${b.month}: ${fmtH(b.active, 2)} per present day (partial months excluded).`,
    link: { page: 'teams', anchor: 'monthly' },
  };
}

export function lowestPeopleInsight(list: PersonStat[], t: Threshold): Insight | null {
  if (!list.length) return null;
  const depts = new Map<string, number>();
  list.forEach((p) => depts.set(p.emp.department, (depts.get(p.emp.department) ?? 0) + 1));
  const top = [...depts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
  return {
    tone: 'opportunity',
    title: `${list.length} people average ${thresholdText(t)}`,
    body: `Most are in ${top.map(([d, n]) => `${d} (${n})`).join(' and ')}. Pair this list with the manager's view of off-screen work before any conversation.`,
    link: { page: 'people', anchor: 'threshold' },
  };
}
