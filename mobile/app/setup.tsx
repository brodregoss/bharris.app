import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { setOnboarded } from '@/src/services/sessionStore';
import type { ExamTiming, ExamType, StudySetup } from '@/src/core/types';

function Stepper({
  value,
  onChange,
  min = 0,
  suffix,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  suffix?: string;
}) {
  const set = (n: number) => onChange(Math.max(min, Math.round(n)));
  return (
    <View style={styles.stepper}>
      <Pressable onPress={() => set(value - 1)} style={styles.stepBtn}>
        <Text style={styles.stepBtnText}>−</Text>
      </Pressable>
      <Text style={styles.stepValue}>
        {value}
        {suffix ? ` ${suffix}` : ''}
      </Text>
      <Pressable onPress={() => set(value + 1)} style={styles.stepBtn}>
        <Text style={styles.stepBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

export default function SetupScreen() {
  const router = useRouter();
  const [terms, setTerms] = useState(40);
  const [hours, setHours] = useState(5);
  const [examType, setExamType] = useState<ExamType>('mixed');
  const [examTiming, setExamTiming] = useState<ExamTiming>('today');

  const canStart = terms > 0 && hours > 0 && examType && examTiming;

  const start = async () => {
    await setOnboarded();
    const setup: StudySetup = { terms, hours, examType, examTiming };
    router.push({ pathname: '/upload-notes', params: { setup: JSON.stringify(setup) } });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Set up your cram</Text>
      <Text style={styles.sub}>Tell us what you're facing — we'll pace the session.</Text>

      <Text style={styles.label}>How many terms roughly?</Text>
      <Stepper value={terms} onChange={setTerms} min={1} />

      <Text style={styles.label}>Hours until exam / sleep</Text>
      <Stepper value={hours} onChange={setHours} min={1} suffix="hrs" />

      <Text style={styles.label}>Exam type</Text>
      <View style={styles.row}>
        {(['mixed', 'multiple_choice', 'short_answer'] as ExamType[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.chip, examType === t && styles.chipActive]}
            onPress={() => setExamType(t)}
          >
            <Text style={[styles.chipText, examType === t && styles.chipTextActive]}>
              {t.replace('_', ' ')}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>When's the exam?</Text>
      <View style={styles.row}>
        {(['today', 'tomorrow', 'later'] as ExamTiming[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.chip, examTiming === t && styles.chipActive]}
            onPress={() => setExamTiming(t)}
          >
            <Text style={[styles.chipText, examTiming === t && styles.chipTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[styles.primaryBtn, !canStart && styles.disabled]}
        disabled={!canStart}
        onPress={start}
      >
        <Text style={styles.primaryBtnText}>Next — add notes</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingTop: 56, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '700', color: '#0f172a' },
  sub: { fontSize: 14, color: '#64748b', marginTop: 8, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 20, marginBottom: 8, color: '#334155' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    overflow: 'hidden',
  },
  stepBtn: { paddingHorizontal: 20, paddingVertical: 14 },
  stepBtnText: { fontSize: 24, color: '#64748b' },
  stepValue: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  chipText: { fontSize: 13, color: '#334155', textTransform: 'capitalize' },
  chipTextActive: { color: '#fff' },
  primaryBtn: {
    marginTop: 32,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  disabled: { opacity: 0.4 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
