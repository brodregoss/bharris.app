function stamp(hit) {
  return Number(hit?.timestamp || hit?.at || 0) || 0;
}

// Enough of a saved set to score minutes cut, without definitions or full recall logs.
export function paceSnapshot(session) {
  if (!session || !Array.isArray(session.terms) || !session.terms.length) return null;
  return {
    id: session.id || '',
    elapsedMs: session.elapsedMs || 0,
    setup: { hours: session.setup?.hours },
    terms: session.terms.map((term) => {
      const stamps = [];
      for (const hit of term?.recallHistory || []) {
        const ts = stamp(hit);
        if (ts) stamps.push(ts);
      }
      stamps.sort((a, b) => a - b);
      const recallHistory = stamps.length
        ? [{ timestamp: stamps[0] }, ...(stamps.length > 1 ? [{ timestamp: stamps[stamps.length - 1] }] : [])]
        : [];
      const snap = {
        seen: !!term?.seen,
        recallHistory,
        correctStreak: term?.correctStreak || 0,
      };
      if (term?.srs?.introduced) snap.srs = { introduced: true };
      if (typeof term?.mastery === 'number') snap.mastery = term.mastery;
      if (term?.testResult === true || term?.testResult === false) snap.testResult = term.testResult;
      return snap;
    }),
  };
}
