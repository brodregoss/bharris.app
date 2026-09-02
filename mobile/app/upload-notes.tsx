import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Moon, Camera, FileText, Check, ArrowRight, X } from 'lucide-react-native';
import { BrandHeader } from '@/src/components/ui/BrandHeader';
import { Button } from '@/src/components/ui/Button';
import { loadFlowSetup, saveFlowSource } from '@/src/services/sessionStore';
import type { NoteSource, StudySetup } from '@/src/core/types';
import { colors, radii, shadows } from '@/src/theme';

const SAMPLES = [
  {
    id: 'psych-101',
    title: 'Psych 101 — Core Concepts',
    meta: 'Classical & operant conditioning, memory, perception',
    terms: 24,
  },
  {
    id: 'test-sample',
    title: 'Sample Test Notes',
    meta: 'Mixed terms for demo: cognition, biology, stats',
    terms: 18,
  },
];

type Selected =
  | ({ kind: 'sample' } & (typeof SAMPLES)[0])
  | { kind: 'photo'; name: string; uri: string; title: string; terms: number };

export default function UploadNotesScreen() {
  const router = useRouter();
  const [setup, setSetup] = useState<StudySetup | undefined>();
  const [selected, setSelected] = useState<Selected | null>(null);

  useEffect(() => {
    loadFlowSetup().then((s) => setSetup(s ?? undefined));
  }, []);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSelected({
        kind: 'photo',
        name: asset.fileName || 'Photo notes',
        uri: asset.uri,
        title: 'Photo notes',
        terms: setup?.terms || 12,
      });
    }
  };

  const continueToTriage = async () => {
    if (!selected) return;
    const source: NoteSource =
      selected.kind === 'sample'
        ? { kind: 'sample', title: selected.title, terms: selected.terms, id: selected.id }
        : { kind: 'photo', title: selected.title, terms: selected.terms };
    await saveFlowSource(source);
    router.push('/triage');
  };

  return (
    <LinearGradient colors={[colors.slate50, colors.slate100]} style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <BrandHeader icon={<Moon size={18} color="#fff" />} subtitle="Cram smarter, not harder" />

          <Text style={styles.heading}>Upload your notes</Text>
          <Text style={styles.lead}>Snap a photo of your notes, or grab a sample set to test the app.</Text>

          <Pressable
            onPress={pickPhoto}
            style={[styles.photoBox, selected?.kind === 'photo' && styles.photoBoxActive]}
          >
            <View style={styles.photoIcon}>
              <Camera size={20} color={colors.slate800} />
            </View>
            <Text style={styles.photoTitle}>Take or upload a photo</Text>
            <Text style={styles.photoHint}>JPG / PNG · your handwritten or printed notes</Text>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or use sample notes</Text>
            <View style={styles.divider} />
          </View>

          {SAMPLES.map((s) => {
            const active = selected?.kind === 'sample' && selected.id === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => setSelected({ kind: 'sample', ...s })}
                style={[styles.sample, active && styles.sampleActive]}
              >
                <View style={styles.sampleIcon}>
                  <FileText size={20} color={colors.slate800} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.sampleTitleRow}>
                    <Text style={styles.sampleTitle} numberOfLines={1}>
                      {s.title}
                    </Text>
                    {active && <Check size={16} color={colors.slate900} />}
                  </View>
                  <Text style={styles.sampleMeta}>{s.meta}</Text>
                  <Text style={styles.sampleTerms}>{s.terms} terms</Text>
                </View>
              </Pressable>
            );
          })}

          {selected && (
            <View style={styles.preview}>
              {selected.kind === 'photo' ? (
                <Image source={{ uri: selected.uri }} style={styles.previewImg} />
              ) : (
                <View style={styles.previewIcon}>
                  <FileText size={20} color={colors.slate800} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.previewTitle} numberOfLines={1}>
                  {selected.kind === 'photo' ? 'Photo selected' : selected.title}
                </Text>
                <Text style={styles.previewSub}>
                  {selected.kind === 'photo' ? selected.name : `${selected.terms} sample terms`}
                </Text>
              </View>
              <Pressable onPress={() => setSelected(null)} hitSlop={8}>
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label="Start Triage"
            disabled={!selected}
            onPress={continueToTriage}
            icon={<ArrowRight size={18} color="#fff" />}
            variant={selected ? 'primary' : 'muted'}
            style={selected ? [styles.cta, shadows.button] : styles.cta}
          />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  heading: { fontSize: 24, fontWeight: '700', marginTop: 20, letterSpacing: -0.3 },
  lead: { fontSize: 14, color: colors.muted, marginTop: 4, marginBottom: 24 },
  photoBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radii.xl,
    padding: 24,
    alignItems: 'center',
    backgroundColor: colors.card,
    gap: 8,
  },
  photoBoxActive: { borderColor: colors.slate900, backgroundColor: 'rgba(15,23,42,0.05)' },
  photoIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoTitle: { fontSize: 14, fontWeight: '600' },
  photoHint: { fontSize: 12, color: colors.muted },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: 12, color: colors.muted },
  sample: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginBottom: 12,
  },
  sampleActive: { borderColor: colors.slate900, backgroundColor: 'rgba(15,23,42,0.05)' },
  sampleIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.lg,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sampleTitleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  sampleTitle: { fontSize: 14, fontWeight: '600', flex: 1 },
  sampleMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  sampleTerms: { fontSize: 11, color: colors.mutedLight, marginTop: 4 },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    padding: 12,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  previewImg: { width: 48, height: 48, borderRadius: radii.lg },
  previewIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTitle: { fontSize: 14, fontWeight: '500' },
  previewSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  footer: { paddingHorizontal: 24, paddingBottom: 16 },
  cta: { height: 56, borderRadius: radii.xl },
});
