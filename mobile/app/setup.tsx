import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Timer,
  BookOpen,
  Clock,
  GraduationCap,
  CalendarClock,
  ArrowRight,
  RotateCcw,
} from 'lucide-react-native';
import { Stepper } from '@/src/components/ui/Stepper';
import { SelectField } from '@/src/components/ui/SelectField';
import { Button } from '@/src/components/ui/Button';
import { BrandHeader } from '@/src/components/ui/BrandHeader';
import { setOnboarded, loadSession, saveFlowSetup } from '@/src/services/sessionStore';
import type { ExamTiming, ExamType, SessionData, StudySetup } from '@/src/core/types';
import { colors, radii, shadows } from '@/src/theme';

function Field({
  icon,
  label,
  hint,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={fieldStyles.wrap}>
      <View style={fieldStyles.labelRow}>
        {icon}
        <Text style={fieldStyles.label}>{label}</Text>
      </View>
      {children}
      {hint ? <Text style={fieldStyles.hint}>{hint}</Text> : null}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: { gap: 10 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 14, fontWeight: '500' },
  hint: { fontSize: 12, color: colors.muted, paddingLeft: 24 },
});

export default function SetupScreen() {
  const router = useRouter();
  const [terms, setTerms] = useState(40);
  const [hours, setHours] = useState(5);
  const [examType, setExamType] = useState('');
  const [examTiming, setExamTiming] = useState('');
  const [resumeSession, setResumeSession] = useState<SessionData | null>(null);

  useEffect(() => {
    loadSession().then(setResumeSession);
  }, []);

  const canStart = terms > 0 && hours > 0 && examType && examTiming;
  const perTerm = terms && hours ? ((hours * 60) / terms).toFixed(1) : null;

  const start = async () => {
    await setOnboarded();
    const setup: StudySetup = {
      terms,
      hours,
      examType: examType as ExamType,
      examTiming: examTiming as ExamTiming,
    };
    await saveFlowSetup(setup);
    router.push('/upload-notes');
  };

  return (
    <LinearGradient colors={[colors.slate50, colors.slate100]} style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <BrandHeader
            icon={<Timer size={18} color="#fff" />}
            subtitle="Cram smarter, not harder"
          />

          {resumeSession && (
            <View style={styles.resumeCard}>
              <View style={styles.resumeIcon}>
                <RotateCcw size={16} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.resumeTitle}>Resume your session</Text>
                <Text style={styles.resumeSub}>Pick up where you left off.</Text>
              </View>
              <Button label="Resume" onPress={() => router.push('/study')} style={styles.resumeBtn} textStyle={{ fontSize: 14 }} />
            </View>
          )}

          <Text style={styles.heading}>What are we cramming?</Text>
          <Text style={styles.lead}>
            Tell us the basics — we'll build a plan that fits the time you have.
          </Text>

          <View style={styles.fields}>
            <Field
              icon={<BookOpen size={16} color={colors.muted} />}
              label="Number of terms / concepts"
              hint={perTerm ? `≈ ${perTerm} min per term` : undefined}
            >
              <Stepper value={terms} onChange={setTerms} min={0} step={5} />
            </Field>

            <Field icon={<Clock size={16} color={colors.muted} />} label="Hours available" hint="Time until the exam">
              <Stepper value={hours} onChange={setHours} min={0} step={1} suffix="hr" />
            </Field>

            <Field icon={<GraduationCap size={16} color={colors.muted} />} label="Exam type">
              <SelectField
                value={examType}
                onChange={setExamType}
                placeholder="Select exam type"
                options={[
                  { value: 'multiple_choice', label: 'Multiple Choice' },
                  { value: 'short_answer', label: 'Short Answer' },
                  { value: 'mixed', label: 'Mixed (both)' },
                ]}
              />
            </Field>

            <Field
              icon={<CalendarClock size={16} color={colors.muted} />}
              label="Exam timing"
              hint="Sleep-protection is tailored to how soon you test."
            >
              <SelectField
                value={examTiming}
                onChange={setExamTiming}
                placeholder="When is the exam?"
                options={[
                  { value: 'today', label: 'Today' },
                  { value: 'tomorrow', label: 'Tomorrow' },
                  { value: '2days', label: 'In 2 days' },
                ]}
              />
            </Field>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label="Upload Notes"
            disabled={!canStart}
            onPress={start}
            icon={<ArrowRight size={18} color="#fff" />}
            iconPosition="right"
            variant={canStart ? 'primary' : 'muted'}
            style={canStart ? [styles.cta, shadows.button] : styles.cta}
          />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    marginTop: 20,
    marginBottom: 8,
    ...shadows.card,
  },
  resumeIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    backgroundColor: colors.slate900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeTitle: { fontSize: 14, fontWeight: '600' },
  resumeSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  resumeBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  heading: { fontSize: 24, fontWeight: '700', marginTop: 16, letterSpacing: -0.3 },
  lead: { fontSize: 14, color: colors.muted, marginTop: 4, marginBottom: 24 },
  fields: { gap: 20 },
  footer: { paddingHorizontal: 24, paddingBottom: 16 },
  cta: { height: 56, borderRadius: radii.xl },
});
