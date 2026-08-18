import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { generateTriageTerms, formatAiError } from '@/src/services/aiService';
import { TIERS, type RawTerm } from '@/src/core/triageUtils';
import {
  tierFromDifficulty,
  confidenceFromTriage,
  normalizeExamType,
} from '@/src/core/studyUtils';
import type { StudySetup } from '@/src/core/types';

export default function TriageScreen() {
  const router = useRouter();
  const { setup: setupRaw, source: sourceRaw } = useLocalSearchParams<{
    setup?: string;
    source?: string;
  }>();
  const setup: StudySetup | undefined = setupRaw ? JSON.parse(setupRaw) : undefined;
  const source = sourceRaw ? JSON.parse(sourceRaw) : { title: 'Intro Psychology', terms: 12 };
  const sourceTitle = source.title || 'Intro Psychology';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ranked, setRanked] = useState<RawTerm[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const count = Math.min(source.terms || 12, 15);
        const terms = await generateTriageTerms(sourceTitle, count);
        if (mounted) {
          setRanked(terms);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(formatAiError(err));
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [sourceTitle, source.terms]);

  const cycleTier = (id: string) => {
    setRanked((prev) =>
      prev.map((t) => {
        if (t.id !== id || !t.tier) return t;
        const order = ['blank', 'shaky', 'know_it'] as const;
        const idx = order.indexOf(t.tier);
        return { ...t, tier: order[(idx + 1) % order.length] };
      }),
    );
  };

  const lockIn = () => {
    const studyTerms = ranked.map((t) => ({
      id: t.id,
      term: t.term,
      definition: t.definition,
      difficulty: t.difficulty,
      tier: tierFromDifficulty(t.difficulty, normalizeExamType(setup?.examType ?? 'mixed')),
      confidence: confidenceFromTriage(t.tier ?? 'blank'),
      depends_on: t.depends_on || [],
      recallHistory: [],
      correctStreak: 0,
      seen: false,
      testResult: null,
    }));
    router.push({
      pathname: '/study',
      params: {
        terms: JSON.stringify(studyTerms),
        setup: setupRaw ?? '',
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0f172a" />
        <Text style={styles.loadingTitle}>Analyzing your notes…</Text>
        <Text style={styles.loadingSub}>Extracting terms and ranking by difficulty.</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Triage failed</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Triage your terms</Text>
        <Text style={styles.headerSub}>Tap a card to move it between tiers.</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.board}>
        {TIERS.map((tier) => {
          const items = ranked.filter((t) => t.tier === tier.id);
          return (
            <View key={tier.id} style={styles.column}>
              <View style={[styles.columnHeader, { backgroundColor: tier.bg }]}>
                <Text style={styles.columnLabel}>{tier.label}</Text>
                <Text style={styles.columnCount}>{items.length}</Text>
              </View>
              <ScrollView style={styles.columnBody}>
                {items.map((item) => (
                  <Pressable key={item.id} style={styles.card} onPress={() => cycleTier(item.id)}>
                    <Text style={styles.cardTerm}>{item.term}</Text>
                    <Text style={styles.cardDef} numberOfLines={2}>
                      {item.definition}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>

      <Pressable style={styles.primaryBtn} onPress={lockIn}>
        <Text style={styles.primaryBtnText}>Lock in triage</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 56 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loadingTitle: { fontSize: 16, fontWeight: '600', marginTop: 16 },
  loadingSub: { fontSize: 13, color: '#64748b', marginTop: 8, textAlign: 'center' },
  errorTitle: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  errorText: { fontSize: 14, color: '#dc2626', textAlign: 'center', marginBottom: 24 },
  backBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
  },
  backBtnText: { color: '#fff', fontWeight: '600' },
  header: { paddingHorizontal: 20, marginBottom: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSub: { fontSize: 12, color: '#64748b', marginTop: 4 },
  board: { flex: 1, paddingHorizontal: 8 },
  column: { width: 140, marginHorizontal: 4 },
  columnHeader: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  columnLabel: { fontWeight: '700', fontSize: 13 },
  columnCount: { fontSize: 11, opacity: 0.6 },
  columnBody: { flex: 1, backgroundColor: '#f1f5f9', padding: 6 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTerm: { fontWeight: '700', fontSize: 13 },
  cardDef: { fontSize: 11, color: '#64748b', marginTop: 4 },
  primaryBtn: {
    margin: 20,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
