import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Moon } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StudyHeader } from '@/src/components/study/StudyHeader';
import { BlockSummary } from '@/src/components/study/BlockSummary';
import { RecallBlock } from '@/src/components/study/RecallBlock';
import { PassiveSkim } from '@/src/components/study/PassiveSkim';
import { PracticeTest } from '@/src/components/study/PracticeTest';
import { ConfidenceSheet } from '@/src/components/study/ConfidenceSheet';
import { Button } from '@/src/components/ui/Button';
import {
  priority,
  computeReadiness,
  retireThresholdForTier,
  normalizeExamType,
  passiveRatioFor,
  withinStopWindow,
  shakyTermIds,
  WIND_DOWN_BUDGET_MS,
  BLOCK_BUDGET_RATIO,
} from '@/src/core/studyUtils';
import {
  loadSession,
  saveSession,
  clearSession,
  saveFinishedSession,
  consumeStudyBootstrap,
} from '@/src/services/sessionStore';
import type { SessionData, StudyTerm } from '@/src/core/types';
import { colors } from '@/src/theme';

function byPriorityDesc(a: StudyTerm, b: StudyTerm) {
  return priority(b) - priority(a);
}

const SKIP_ON_WIND_DOWN = ['passive', 'passive_summary', 'test', 'test_summary'];

type Init = {
  terms: StudyTerm[];
  setup: SessionData['setup'];
  phase: string;
  blockStats: SessionData['blockStats'];
  stillShaky: string[];
  behind: boolean;
  stopTime: string | null;
  windDownAcknowledged: boolean;
  sessionStart: number;
};

export function StudyFlowScreen() {
  const router = useRouter();
  const [init, setInit] = useState<Init | null | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const bootstrap = await consumeStudyBootstrap();
      if (bootstrap?.terms?.length) {
        setInit({
          terms: bootstrap.resetState
            ? bootstrap.terms.map((t) => ({
                ...t,
                recallHistory: [],
                correctStreak: 0,
                seen: false,
                testResult: null,
              }))
            : bootstrap.terms,
          setup: bootstrap.setup,
          phase: bootstrap.initialPhase || 'critical',
          blockStats: {},
          stillShaky: [],
          behind: false,
          stopTime: null,
          windDownAcknowledged: false,
          sessionStart: Date.now(),
        });
        return;
      }
      const saved = await loadSession();
      if (saved?.terms?.length) {
        setInit({
          terms: saved.terms,
          setup: saved.setup,
          phase: saved.phase || 'critical',
          blockStats: saved.blockStats || {},
          stillShaky: saved.stillShaky || [],
          behind: saved.behind || false,
          stopTime: saved.stopTime || null,
          windDownAcknowledged: !!saved.windDownAcknowledged,
          sessionStart: Date.now() - (saved.elapsedMs || 0),
        });
        return;
      }
      setInit(null);
    })();
  }, []);

  if (init === undefined) return null;

  if (!init) {
    return (
      <SafeAreaView style={styles.empty}>
        <Text style={styles.emptyText}>No study session found.</Text>
        <Button label="Back to start" onPress={() => router.replace('/')} />
      </SafeAreaView>
    );
  }

  return <StudyFlowInner init={init} onExit={() => router.replace('/')} />;
}

function StudyFlowInner({ init, onExit }: { init: Init; onExit: () => void }) {
  const setup = init.setup;
  const [terms, setTerms] = useState(init.terms);
  const totalMs = Math.max(15 * 60 * 1000, (setup?.hours || 1) * 3600 * 1000);
  const [sessionStart] = useState(init.sessionStart);
  const [phase, setPhase] = useState(init.phase);
  const [blockStats, setBlockStats] = useState(init.blockStats || {});
  const [stillShaky, setStillShaky] = useState(init.stillShaky);
  const [behind, setBehind] = useState(init.behind);
  const [stopTime, setStopTime] = useState<string | null>(init.stopTime);
  const [windDownAcknowledged, setWindDownAcknowledged] = useState(init.windDownAcknowledged);
  const [now, setNow] = useState(Date.now());
  const [roadMapOpen, setRoadMapOpen] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    saveSession({
      setup,
      terms,
      phase,
      blockStats,
      stillShaky,
      behind,
      stopTime,
      windDownAcknowledged,
      elapsedMs: Date.now() - sessionStart,
      savedAt: Date.now(),
    });
  }, [setup, terms, phase, blockStats, stillShaky, behind, stopTime, windDownAcknowledged, sessionStart]);

  useEffect(() => {
    if (withinStopWindow(setup?.examTiming || 'today', stopTime, Date.now()) && SKIP_ON_WIND_DOWN.includes(phase)) {
      setPhase('confidence');
    }
  }, [phase, stopTime, setup?.examTiming]);

  const windDownActive = withinStopWindow(setup?.examTiming || 'today', stopTime, now);
  const shakyIds = useMemo(() => shakyTermIds(terms, stillShaky), [terms, stillShaky]);
  const windDownTerms = useMemo(
    () => terms.filter((t) => shakyIds.has(t.id)).sort(byPriorityDesc),
    [terms, shakyIds],
  );

  const updateTerm = useCallback(
    (id: string, patch: Partial<StudyTerm>) =>
      setTerms((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))),
    [],
  );
  const logAttempt = useCallback((id: string, result: 'got_it' | 'missed') => {
    setTerms((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, recallHistory: [...(t.recallHistory || []), { timestamp: Date.now(), result }] }
          : t,
      ),
    );
  }, []);

  const timeRemainingMs = totalMs - (now - sessionStart);
  const readiness = computeReadiness(terms);
  const criticalBudget = totalMs * BLOCK_BUDGET_RATIO.critical;
  const coreBudget = totalMs * BLOCK_BUDGET_RATIO.core;
  const testBudget = totalMs * BLOCK_BUDGET_RATIO.test;
  const windDown = windDownActive;

  const criticalTerms = terms.filter((t) => t.tier === 'critical').sort(byPriorityDesc);
  const coreTerms = terms.filter((t) => t.tier === 'core').sort(byPriorityDesc);
  const passiveTerms = terms.filter((t) => t.tier === 'passive').sort(byPriorityDesc);

  const priorMissed = terms
    .filter(
      (t) =>
        (t.recallHistory || []).some((h) => h.result === 'missed') ||
        ((t.tier === 'critical' || t.tier === 'core') &&
          (t.correctStreak || 0) < retireThresholdForTier(t.tier)),
    )
    .map((t) => t.id);

  const goPassive = () => {
    const examType = normalizeExamType(setup?.examType || 'mixed');
    const remaining = totalMs - (now - sessionStart);
    const passiveBudget = totalMs * passiveRatioFor(examType);
    const protectedTime = testBudget + totalMs * BLOCK_BUDGET_RATIO.confidence;
    const sensitivity = examType === 'short_answer' ? 0.8 : examType === 'mcq' ? 1.3 : 1.0;
    if (remaining < (passiveBudget + protectedTime) * sensitivity) setBehind(true);
    setPhase('passive');
  };

  let blockLabel = 'Study session';
  let content: React.ReactNode = null;

  switch (phase) {
    case 'critical':
      blockLabel = windDown ? 'Wind-down drill' : 'Critical recall';
      content = (
        <RecallBlock
          terms={windDown ? windDownTerms : criticalTerms}
          retireThreshold={windDown ? 1 : 2}
          blockBudgetMs={windDown ? WIND_DOWN_BUDGET_MS : criticalBudget}
          blockLabel={blockLabel}
          examType={setup?.examType || 'mixed'}
          onUpdateTerm={updateTerm}
          onLogAttempt={logAttempt}
          onDone={(s) => {
            setBlockStats((b) => ({ ...b, critical: s }));
            setPhase(windDown ? 'confidence' : 'critical_summary');
          }}
        />
      );
      break;
    case 'critical_summary':
      content = (
        <BlockSummary
          title="Critical block done"
          message={`Nice, you got ${blockStats.critical?.got || 0} of ${blockStats.critical?.total || 0} Critical terms. Now let's hit Core — should take about ${Math.round(coreBudget / 60000)} minutes.`}
          onContinue={() => setPhase('core')}
        />
      );
      break;
    case 'core':
      blockLabel = windDown ? 'Wind-down drill' : 'Core recall';
      content = (
        <RecallBlock
          terms={windDown ? windDownTerms : coreTerms}
          retireThreshold={1}
          blockBudgetMs={windDown ? WIND_DOWN_BUDGET_MS : coreBudget}
          blockLabel={blockLabel}
          examType={setup?.examType || 'mixed'}
          onUpdateTerm={updateTerm}
          onLogAttempt={logAttempt}
          onDone={(s) => {
            setBlockStats((b) => ({ ...b, core: s }));
            setPhase(windDown ? 'confidence' : 'core_summary');
          }}
        />
      );
      break;
    case 'core_summary':
      content = (
        <BlockSummary
          title="Core block done"
          message={`Solid — ${blockStats.core?.got || 0} of ${blockStats.core?.total || 0} Core terms down. Quick pass on the rest, then a practice test.`}
          onContinue={goPassive}
        />
      );
      break;
    case 'passive':
      blockLabel = 'Passive skim';
      content = (
        <PassiveSkim terms={passiveTerms} behind={behind} onUpdateTerm={updateTerm} onDone={() => setPhase('passive_summary')} />
      );
      break;
    case 'passive_summary':
      content = (
        <BlockSummary title="All reviewed" message="That's everything reviewed. Time for a practice test." onContinue={() => setPhase('test')} />
      );
      break;
    case 'test':
      blockLabel = 'Practice test';
      content = (
        <PracticeTest
          terms={terms}
          examType={setup?.examType || 'mixed'}
          budgetMs={testBudget}
          priorMissed={priorMissed}
          onDone={({ missedIds, questionIds }) => {
            setStillShaky(missedIds);
            const miss = new Set(missedIds);
            setTerms((prev) =>
              prev.map((t) => (questionIds.includes(t.id) ? { ...t, testResult: !miss.has(t.id) } : t)),
            );
            setPhase('test_summary');
          }}
        />
      );
      break;
    case 'test_summary':
      content = (
        <BlockSummary title="Test done" message="Here's what's still shaky — let's lock those in." onContinue={() => setPhase('confidence')} />
      );
      break;
    case 'confidence':
      blockLabel = 'Confidence sheet';
      content = (
        <ConfidenceSheet
          terms={terms}
          examTiming={setup?.examTiming || 'today'}
          stillShaky={stillShaky}
          readiness={readiness}
          onUpdateTerm={updateTerm}
          onLogAttempt={logAttempt}
          stopTime={stopTime}
          onSetStopTime={setStopTime}
          onDone={async () => {
            await saveFinishedSession({ terms, setup, finishedAt: Date.now() });
            await clearSession();
            onExit();
          }}
        />
      );
      break;
  }

  return (
    <SafeAreaView style={styles.shell} edges={['top']}>
      <StudyHeader readiness={readiness} timeRemainingMs={timeRemainingMs} blockLabel={blockLabel} />
      {windDownActive && !windDownAcknowledged && (
        <View style={styles.windDown}>
          <Moon size={16} color={colors.amber700} />
          <Text style={styles.windDownText}>
            You're close to your stop time — here's your last quick pass, then get some sleep.
          </Text>
          <Pressable onPress={() => setWindDownAcknowledged(true)}>
            <Text style={styles.windDownBtn}>Got it</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.content}>{content}</View>
      <View style={styles.footer}>
        <Pressable onPress={() => setRoadMapOpen(true)}>
          <Text style={styles.roadMap}>road map</Text>
        </Pressable>
      </View>
      <Modal visible={roadMapOpen} transparent animationType="slide" onRequestClose={() => setRoadMapOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setRoadMapOpen(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Session roadmap</Text>
            <Text style={styles.modalPhase}>Current: {phase.replace('_', ' ')}</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {terms
                .slice()
                .sort(byPriorityDesc)
                .map((t) => (
                  <View key={t.id} style={styles.roadRow}>
                    <Text style={styles.roadTerm}>{t.term}</Text>
                    <Text style={styles.roadMeta}>
                      {t.tier} · {t.confidence} · streak {t.correctStreak || 0}
                    </Text>
                  </View>
                ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.background },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  emptyText: { color: colors.muted, marginBottom: 8 },
  content: { flex: 1 },
  windDown: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.amber50,
    borderBottomWidth: 1,
    borderBottomColor: colors.amber200,
  },
  windDownText: { flex: 1, fontSize: 12, color: colors.amber800, lineHeight: 18 },
  windDownBtn: { fontSize: 12, fontWeight: '700', color: colors.amber700, textDecorationLine: 'underline' },
  footer: { paddingVertical: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: 'rgba(255,255,255,0.95)' },
  roadMap: { fontSize: 12, color: colors.muted, textDecorationLine: 'underline' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  modalPhase: { fontSize: 13, color: colors.muted, marginBottom: 12 },
  roadRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  roadTerm: { fontSize: 14, fontWeight: '600' },
  roadMeta: { fontSize: 11, color: colors.muted, marginTop: 2, textTransform: 'capitalize' },
});
