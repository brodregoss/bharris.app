import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  loadSession,
  saveSession,
  clearSession,
  saveFinishedSession,
} from '@/src/services/sessionStore';
import { computeReadiness, priority, retireThresholdForTier } from '@/src/core/studyUtils';
import type { SessionData, StudyTerm } from '@/src/core/types';

function byPriority(a: StudyTerm, b: StudyTerm) {
  return priority(b) - priority(a);
}

export default function StudyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ terms?: string; setup?: string; restart?: string }>();
  const [loading, setLoading] = useState(true);
  const [terms, setTerms] = useState<StudyTerm[]>([]);
  const [setup, setSetup] = useState<SessionData['setup']>();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const hydrate = useCallback(async () => {
    if (params.terms) {
      const parsed = JSON.parse(params.terms) as StudyTerm[];
      const s = params.setup ? JSON.parse(params.setup) : undefined;
      setTerms(parsed);
      setSetup(s);
      await saveSession({ terms: parsed, setup: s, phase: 'critical', sessionStart: Date.now() });
      setLoading(false);
      return;
    }
    const saved = await loadSession();
    if (!saved?.terms?.length) {
      router.replace('/');
      return;
    }
    setTerms(saved.terms);
    setSetup(saved.setup);
    setLoading(false);
  }, [params.setup, params.terms, router]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const queue = useMemo(
    () =>
      [...terms]
        .filter((t) => (t.correctStreak || 0) < retireThresholdForTier(t.tier))
        .sort(byPriority),
    [terms],
  );

  const current = queue[index] ?? queue[0];
  const readiness = computeReadiness(terms);

  const record = async (gotIt: boolean) => {
    if (!current) return;
    const updated = terms.map((t) => {
      if (t.id !== current.id) return t;
      const history = [...(t.recallHistory || []), { result: gotIt ? 'got_it' : 'missed' } as const];
      return {
        ...t,
        seen: true,
        recallHistory: history,
        correctStreak: gotIt ? (t.correctStreak || 0) + 1 : 0,
      };
    });
    setTerms(updated);
    setRevealed(false);
    setIndex((i) => (i + 1) % Math.max(queue.length, 1));
    await saveSession({ terms: updated, setup, phase: 'critical', sessionStart: Date.now() });
  };

  const finish = async () => {
    await saveFinishedSession({ terms, setup });
    await clearSession();
    router.replace('/');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!current) {
    return (
      <View style={styles.center}>
        <Text style={styles.doneTitle}>Session complete</Text>
        <Text style={styles.doneSub}>Readiness: {readiness}%</Text>
        <Pressable style={styles.primaryBtn} onPress={finish}>
          <Text style={styles.primaryBtnText}>Back home</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={() => router.push('/panic')}>
          <Text style={styles.secondaryBtnText}>Panic review</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.push('/panic')}>
          <Text style={styles.panicLink}>Panic</Text>
        </Pressable>
        <Text style={styles.readiness}>{readiness}% ready</Text>
      </View>

      <ScrollView contentContainerStyle={styles.cardArea}>
        <Text style={styles.tier}>{current.tier.toUpperCase()}</Text>
        <Text style={styles.term}>{current.term}</Text>
        {revealed ? (
          <Text style={styles.definition}>{current.definition}</Text>
        ) : (
          <Pressable style={styles.revealBtn} onPress={() => setRevealed(true)}>
            <Text style={styles.revealText}>Tap to reveal</Text>
          </Pressable>
        )}
      </ScrollView>

      {revealed && (
        <View style={styles.actions}>
          <Pressable style={[styles.actionBtn, styles.missed]} onPress={() => record(false)}>
            <Text style={styles.actionText}>Missed it</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.gotIt]} onPress={() => record(true)}>
            <Text style={styles.actionText}>Got it</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 56 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  panicLink: { color: '#dc2626', fontWeight: '600' },
  readiness: { fontWeight: '600', color: '#64748b' },
  cardArea: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  tier: { fontSize: 12, color: '#64748b', letterSpacing: 1, marginBottom: 8 },
  term: { fontSize: 32, fontWeight: '700', color: '#0f172a' },
  definition: { fontSize: 18, color: '#334155', marginTop: 24, lineHeight: 28 },
  revealBtn: {
    marginTop: 32,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  revealText: { color: '#64748b', fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 12, padding: 20, paddingBottom: 40 },
  actionBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  missed: { backgroundColor: '#fecaca' },
  gotIt: { backgroundColor: '#bbf7d0' },
  actionText: { fontWeight: '700', fontSize: 16 },
  doneTitle: { fontSize: 24, fontWeight: '700' },
  doneSub: { fontSize: 16, color: '#64748b', marginVertical: 12 },
  primaryBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '600' },
  secondaryBtn: { marginTop: 12, padding: 12 },
  secondaryBtnText: { color: '#2563eb', fontWeight: '600' },
});
