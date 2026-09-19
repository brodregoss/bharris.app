import { priority, SKIM_TIER_ORDER, TIER_LABELS } from '@/lib/studyUtils';

function sortByPri(list) {
  return list.slice().sort((a, b) => priority(b) - priority(a));
}

function uniqueIds(ids) {
  const seen = new Set();
  const out = [];
  (ids || []).forEach((id) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  });
  return out;
}

function makeCategory(id, name, members) {
  return {
    id,
    name,
    termIds: sortByPri(members).map((t) => t.id),
  };
}

function categoriesFromTiers(list) {
  const cats = [];
  for (const tier of SKIM_TIER_ORDER) {
    const members = list.filter((t) => t.tier === tier);
    if (!members.length) continue;
    cats.push(makeCategory(`tier-${tier}`, TIER_LABELS[tier] || tier, members));
  }
  const other = list.filter((t) => !SKIM_TIER_ORDER.includes(t.tier));
  if (other.length) cats.push(makeCategory('ungrouped', 'Ungrouped', other));
  if (!cats.length && list.length) cats.push(makeCategory('all', 'All terms', list));
  return cats;
}

export function groupTermsIntoCategories(terms) {
  const list = (Array.isArray(terms) ? terms : []).filter((t) => t?.id);
  if (!list.length) return [];

  const byName = new Map();
  list.forEach((t) => {
    const key = String(t.term || '').trim().toLowerCase();
    if (key) byName.set(key, t.id);
  });

  const parent = new Map();
  const find = (id) => {
    if (!parent.has(id)) parent.set(id, id);
    const p = parent.get(id);
    if (p !== id) parent.set(id, find(p));
    return parent.get(id);
  };
  const union = (a, b) => {
    const pa = find(a);
    const pb = find(b);
    if (pa !== pb) parent.set(pa, pb);
  };

  list.forEach((t) => find(t.id));
  list.forEach((t) => {
    (t.depends_on || []).forEach((name) => {
      const otherId = byName.get(String(name || '').trim().toLowerCase());
      if (otherId) union(t.id, otherId);
    });
  });

  const groups = new Map();
  list.forEach((t) => {
    const root = find(t.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(t);
  });

  const clustered = [];
  const singles = [];
  groups.forEach((members) => {
    const linked = members.length > 1 || members.some((t) => (t.depends_on || []).length);
    if (!linked) singles.push(...members);
    else {
      const nameCounts = {};
      members.forEach((t) => {
        (t.depends_on || []).forEach((n) => {
          const k = String(n || '').trim();
          if (k) nameCounts[k] = (nameCounts[k] || 0) + 1;
        });
      });
      const name =
        Object.entries(nameCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || members[0].term || 'Category';
      clustered.push(makeCategory(members.map((m) => m.id).sort().join('-'), name, members));
    }
  });

  if (!clustered.length) return categoriesFromTiers(list);

  const cats = [...clustered];
  if (singles.length) cats.push(makeCategory('ungrouped', 'Ungrouped', singles));
  return cats;
}

export function initTrueCramState(terms) {
  const categories = groupTermsIntoCategories(terms);
  const first = categories[0];
  if (!first?.termIds?.length) {
    return {
      phase: 'fork',
      categories,
      categoryIndex: 0,
      pass: 'first',
      queue: [],
      queueIndex: 0,
      missedThisPass: [],
      carryForward: [],
      flaggedTermIds: [],
      coveredIds: [],
    };
  }
  return {
    phase: 'cockpit',
    categories,
    categoryIndex: 0,
    pass: 'first',
    queue: first.termIds,
    queueIndex: 0,
    missedThisPass: [],
    carryForward: [],
    flaggedTermIds: [],
    coveredIds: [],
  };
}

function withCovered(state, id) {
  if (!id || (state.coveredIds || []).includes(id)) return state.coveredIds || [];
  return [...(state.coveredIds || []), id];
}

function startCategory(state, categoryIndex, carryForward) {
  const cat = state.categories[categoryIndex];
  return {
    ...state,
    phase: 'cockpit',
    categoryIndex,
    pass: 'first',
    queue: cat?.termIds || [],
    queueIndex: 0,
    missedThisPass: [],
    carryForward: carryForward || [],
  };
}

function startMissReview(state, flaggedTermIds, missedThisPass) {
  const reviewQueue = uniqueIds([...(state.carryForward || []), ...missedThisPass]);
  if (!reviewQueue.length) return finishPass({ ...state, flaggedTermIds, missedThisPass: [] });
  return {
    ...state,
    phase: 'cockpit',
    pass: 'miss_review',
    queue: reviewQueue,
    queueIndex: 0,
    missedThisPass: [],
    carryForward: [],
    flaggedTermIds,
  };
}

function finishPass(state) {
  if (state.pass === 'flagged') {
    return { ...state, phase: 'fork', queue: [], queueIndex: 0 };
  }
  const nextCat = state.categoryIndex + 1;
  if (nextCat >= (state.categories || []).length) {
    return { ...state, phase: 'fork', queue: [], queueIndex: 0 };
  }
  const carry = state.pass === 'miss_review' ? state.missedThisPass : [];
  return startCategory(state, nextCat, carry);
}

export function gradeTrueCram(state, correct) {
  const id = state.queue?.[state.queueIndex];
  const flagged = new Set(state.flaggedTermIds || []);
  const missedThisPass = [...(state.missedThisPass || [])];
  if (id && !correct) {
    flagged.add(id);
    missedThisPass.push(id);
  }
  const flaggedTermIds = [...flagged];
  const coveredIds = withCovered(state, id);
  const nextIndex = (state.queueIndex || 0) + 1;
  const nextBase = { ...state, flaggedTermIds, missedThisPass, coveredIds };

  if (nextIndex < (state.queue || []).length) {
    return { ...nextBase, queueIndex: nextIndex };
  }

  if (state.pass === 'first') {
    return startMissReview({ ...nextBase, queueIndex: 0 }, flaggedTermIds, missedThisPass);
  }

  return finishPass({ ...nextBase, queueIndex: 0 });
}

export function jumpToTerm(state, termId) {
  if (!termId) return state;
  if (state.pass === 'flagged') {
    const i = (state.queue || []).indexOf(termId);
    if (i >= 0) return { ...state, queueIndex: i };
  }
  const cats = state.categories || [];
  const categoryIndex = cats.findIndex((c) => (c.termIds || []).includes(termId));
  if (categoryIndex < 0) return state;
  const queue = cats[categoryIndex].termIds || [];
  const queueIndex = queue.indexOf(termId);
  if (queueIndex < 0) return state;
  return {
    ...state,
    phase: 'cockpit',
    pass: 'first',
    categoryIndex,
    queue,
    queueIndex,
  };
}

export function startFlaggedPass(state) {
  const queue = uniqueIds(state.flaggedTermIds);
  if (!queue.length) return { ...state, phase: 'fork', queue: [], queueIndex: 0 };
  return {
    ...state,
    phase: 'cockpit',
    pass: 'flagged',
    categoryIndex: 0,
    queue,
    queueIndex: 0,
    missedThisPass: [],
    carryForward: [],
  };
}

export function currentCategoryName(state) {
  if (state.pass === 'flagged') return 'Flagged';
  return state.categories?.[state.categoryIndex]?.name || 'Category';
}

export function passLabel(pass) {
  if (pass === 'miss_review') return 'Miss review';
  if (pass === 'flagged') return 'Flagged';
  return 'First pass';
}
