import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Moon, Brain, CheckCircle2 } from 'lucide-react-native';
import { Button } from '@/src/components/ui/Button';
import { RecallBlock } from './RecallBlock';
import { SleepTimePicker } from './SleepTimePicker';
import { retireThresholdForTier } from '@/src/core/studyUtils';
import type { StudyTerm } from '@/src/core/types';
import { colors, radii, shadows } from '@/src/theme';

type Props = {
  terms: StudyTerm[];
  examTiming: string;
  stillShaky: string[];
  readiness: number;
  onUpdateTerm: (id: string, patch: Partial<StudyTerm>) => void;
  onLogAttempt: (id: string, result: 'got_it' | 'missed') => void;
  onDone: () => void;
  stopTime: string | null;
  onSetStopTime: (v: string) => void;
};

export function ConfidenceSheet({
  terms,
  examTiming,
  stillShaky,
  readiness,
  onUpdateTerm,
  onLogAttempt,
  onDone,
  stopTime,
  onSetStopTime,
}: Props) {
  const shakyTerms = useMemo(() => {
    const set = new Set(stillShaky);
    terms.forEach((t) => {
      if (
        (t.tier === 'critical' || t.tier === 'core') &&
        (t.correctStreak || 0) < retireThresholdForTier(t.tier)
      ) {
        set.add(t.id);
      }
    });
    return terms.filter((t) => set.has(t.id));
  }, [terms, stillShaky]);

  const [view, setView] = useState<'list' | 'drill' | 'final'>('list');
  const [editingStop, setEditingStop] = useState(false);
  const needStopTime = examTiming !== 'today' && (!stopTime || editingStop);

  if (needStopTime) {
    return (
      <View style={styles.sleepWrap}>
        <Moon size={40} color={colors.muted} />
        <Text style={styles.sleepTitle}>What time are you planning to sleep?</Text>
        <Text style={styles.sleepSub}>
          Sleep locks in recall. Pick a hard stop so we don't let you cram past the point of returns.
        </Text>
        <SleepTimePicker value={stopTime} onChange={onSetStopTime} />
        <Button label="Set stop time" disabled={!stopTime} onPress={() => setEditingStop(false)} />
      </View>
    );
  }

  if (view === 'drill') {
    return (
      <RecallBlock
        terms={shakyTerms}
        singlePass
        retireThreshold={1}
        blockBudgetMs={5 * 60 * 1000}
        blockLabel="5-min drill"
        onUpdateTerm={onUpdateTerm}
        onLogAttempt={onLogAttempt}
        onDone={() => setView('final')}
      />
    );
  }

  if (view === 'final') {
    const title = examTiming === '2days' ? 'Day 1 done.' : "You're as ready as you'll be.";
    const body =
      examTiming === '2days'
        ? 'Pick up tomorrow with a quick re-check of everything — some of this will fade overnight, and that is normal.'
        : "Recall locks in after rest. You've put in the work — go in calm.";
    return (
      <ScrollView contentContainerStyle={styles.finalWrap}>
        <View style={styles.iconWrap}>
          <CheckCircle2 size={28} color={colors.emerald600} />
        </View>
        <Text style={styles.finalTitle}>{title}</Text>
        <Text style={styles.finalBody}>{body}</Text>
        <View style={styles.readinessCard}>
          <Text style={styles.readinessLabel}>TEST READINESS</Text>
          <Text style={styles.readinessScore}>{readiness}%</Text>
        </View>
        {shakyTerms.length > 0 && (
          <View style={styles.shakyCard}>
            <Text style={styles.shakyTitle}>Still shaky ({shakyTerms.length})</Text>
            {shakyTerms.map((t) => (
              <Text key={t.id} style={styles.shakyItem}>
                <Text style={{ fontWeight: '600' }}>{t.term}</Text>
                <Text style={{ color: colors.muted }}> — {t.definition}</Text>
              </Text>
            ))}
          </View>
        )}
        <Button label="Done" onPress={onDone} />
      </ScrollView>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.listHeader}>
        <Text style={styles.title}>Confidence sheet</Text>
        <Text style={styles.readinessPct}>{readiness}%</Text>
      </View>
      <Text style={styles.sub}>{shakyTerms.length} terms still shaky — no new material, just these.</Text>
      {examTiming !== 'today' && stopTime && (
        <Pressable onPress={() => setEditingStop(true)}>
          <Text style={styles.sleepLink}>Sleep time: {stopTime} · change</Text>
        </Pressable>
      )}
      <ScrollView style={styles.list} contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
        {shakyTerms.map((t) => (
          <View key={t.id} style={styles.item}>
            <Text style={styles.itemTerm}>{t.term}</Text>
            <Text style={styles.itemDef}>{t.definition}</Text>
          </View>
        ))}
        {shakyTerms.length === 0 && (
          <Text style={styles.empty}>Nothing shaky — you're solid.</Text>
        )}
      </ScrollView>
      {shakyTerms.length === 0 ? (
        <Button label="Finish up" onPress={() => setView('final')} />
      ) : (
        <Button label="5-min drill" onPress={() => setView('drill')} icon={<Brain size={16} color="#fff" />} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700' },
  readinessPct: { fontSize: 14, fontWeight: '700', color: colors.emerald600 },
  sub: { fontSize: 12, color: colors.muted, marginTop: 4, marginBottom: 8 },
  sleepLink: { fontSize: 11, color: colors.muted, textDecorationLine: 'underline', marginBottom: 12 },
  list: { flex: 1, marginBottom: 12 },
  item: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: 12, backgroundColor: colors.card },
  itemTerm: { fontSize: 14, fontWeight: '600' },
  itemDef: { fontSize: 12, color: colors.muted, marginTop: 4 },
  empty: { textAlign: 'center', color: colors.muted, paddingVertical: 32 },
  sleepWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  sleepTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginTop: 16, marginBottom: 8 },
  sleepSub: { fontSize: 14, color: colors.muted, textAlign: 'center', marginBottom: 24, maxWidth: 280 },
  finalWrap: { padding: 20, paddingBottom: 40, alignItems: 'center' },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.emerald50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  finalTitle: { fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  finalBody: { fontSize: 14, color: colors.muted, textAlign: 'center', marginBottom: 24, maxWidth: 320 },
  readinessCard: {
    width: '100%',
    borderRadius: radii.flashcard,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    ...shadows.card,
  },
  readinessLabel: { fontSize: 11, letterSpacing: 1, color: colors.muted },
  readinessScore: { fontSize: 48, fontWeight: '700', marginTop: 4 },
  shakyCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: 16,
    marginBottom: 16,
    backgroundColor: colors.card,
  },
  shakyTitle: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  shakyItem: { fontSize: 12, marginBottom: 6 },
});
