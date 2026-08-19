import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Moon, Loader2, Sparkles, Check } from 'lucide-react-native';
import { generateTriageTerms, formatAiError } from '@/src/services/aiService';
import { TIERS, type RawTerm } from '@/src/core/triageUtils';
import {
  tierFromDifficulty,
  confidenceFromTriage,
  normalizeExamType,
  TRIAGE_TIER_BORDER,
} from '@/src/core/studyUtils';
import {
  loadFlowSetup,
  loadFlowSource,
  saveStudyBootstrap,
} from '@/src/services/sessionStore';
import { Button } from '@/src/components/ui/Button';
import { BrandHeader } from '@/src/components/ui/BrandHeader';
import type { NoteSource, StudySetup } from '@/src/core/types';
import { colors, radii, shadows } from '@/src/theme';

export default function TriageScreen() {
  const router = useRouter();
  const [setup, setSetup] = useState<StudySetup | undefined>();
  const [source, setSource] = useState<NoteSource>({ kind: 'sample', title: 'Intro Psychology', terms: 12 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ranked, setRanked] = useState<RawTerm[]>([]);
  const [animating, setAnimating] = useState(true);
  const toastOpacity = useState(new Animated.Value(0))[0];

  useEffect(() => {
    (async () => {
      const [s, src] = await Promise.all([
        loadFlowSetup(),
        loadFlowSource<NoteSource>(),
      ]);
      if (s) setSetup(s);
      if (src) setSource(src);
    })();
  }, []);

  const sourceTitle = source.title || 'Intro Psychology';

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const count = Math.min(source.terms || 12, 15);
        const terms = await generateTriageTerms(sourceTitle, count);
        if (mounted) {
          setRanked(terms);
          setLoading(false);
          const total = terms.length * 0.06 + 0.6;
          setTimeout(() => mounted && setAnimating(false), total * 1000);
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

  useEffect(() => {
    if (!loading && animating) {
      Animated.sequence([
        Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(2000),
        Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [loading, animating, toastOpacity]);

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

  const lockIn = async () => {
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
    await saveStudyBootstrap({ terms: studyTerms, setup, resetState: true });
    router.push('/study');
  };

  const totalDone = ranked.filter((t) => t.tier === 'know_it').length;

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <Loader2 size={32} color={colors.muted} />
        <Text style={styles.loadingTitle}>Analyzing your notes…</Text>
        <Text style={styles.loadingSub}>Extracting terms and ranking by difficulty and concept relationships.</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorTitle}>Triage failed</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Button label="Go back" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BrandHeader
          icon={<Moon size={18} color="#fff" />}
          title="Last Minute Study"
          subtitle={`Triage — ${sourceTitle}`}
          right={<Text style={styles.readyCount}>{totalDone}/{ranked.length} ready</Text>}
        />
      </View>

      <View style={styles.subHeader}>
        <Text style={styles.subTitle}>Triage your terms</Text>
        <Text style={styles.subHint}>AI ranked them — tap any card to move it between tiers.</Text>
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
              <ScrollView style={styles.columnBody} nestedScrollEnabled>
                {items.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => cycleTier(item.id)}
                    style={[
                      styles.card,
                      { borderLeftColor: TRIAGE_TIER_BORDER[tier.id] },
                      shadows.card,
                    ]}
                  >
                    <Text style={styles.cardTerm} numberOfLines={2}>
                      {item.term}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Lock in triage" onPress={lockIn} icon={<Check size={16} color="#fff" />} style={styles.lockBtn} />
      </View>

      {animating && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Sparkles size={14} color="#fff" />
          <Text style={styles.toastText}>AI ranking based on difficulty and card relations</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.background },
  loadingTitle: { fontSize: 14, fontWeight: '600', marginTop: 16 },
  loadingSub: { fontSize: 12, color: colors.muted, marginTop: 8, textAlign: 'center', maxWidth: 280 },
  errorTitle: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  errorText: { fontSize: 14, color: colors.rose600, textAlign: 'center', marginBottom: 24 },
  header: { paddingHorizontal: 20, paddingTop: 8 },
  readyCount: { fontSize: 12, fontWeight: '500', color: colors.muted },
  subHeader: { paddingHorizontal: 20, paddingVertical: 8 },
  subTitle: { fontSize: 18, fontWeight: '700' },
  subHint: { fontSize: 12, color: colors.muted, marginTop: 4 },
  board: { flex: 1, paddingHorizontal: 8 },
  column: { width: 148, marginHorizontal: 4 },
  columnHeader: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  columnLabel: { fontWeight: '700', fontSize: 13, color: '#000' },
  columnCount: { fontSize: 10, color: 'rgba(0,0,0,0.6)' },
  columnBody: { flex: 1, backgroundColor: colors.slate100, padding: 8 },
  card: {
    backgroundColor: colors.card,
    borderLeftWidth: 4,
    borderRadius: radii.lg,
    padding: 10,
    marginBottom: 8,
  },
  cardTerm: { fontSize: 13, fontWeight: '600' },
  footer: { padding: 20 },
  lockBtn: { height: 48, borderRadius: radii.xl },
  toast: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.slate900,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  toastText: { color: '#fff', fontSize: 12, fontWeight: '500' },
});
