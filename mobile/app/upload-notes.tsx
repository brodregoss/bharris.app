import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

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
    meta: 'Mixed terms for demo',
    terms: 18,
  },
];

export default function UploadNotesScreen() {
  const router = useRouter();
  const { setup: setupRaw } = useLocalSearchParams<{ setup?: string }>();
  const setup = setupRaw ? JSON.parse(setupRaw) : undefined;
  const [selected, setSelected] = useState<(typeof SAMPLES)[0] | null>(null);

  const continueToTriage = () => {
    if (!selected) return;
    router.push({
      pathname: '/triage',
      params: {
        setup: setupRaw ?? '',
        source: JSON.stringify({
          kind: 'sample',
          title: selected.title,
          terms: selected.terms,
        }),
      },
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Upload your notes</Text>
      <Text style={styles.sub}>Pick a sample set for now — photo upload coming soon.</Text>

      <Pressable style={styles.photoBox}>
        <Text style={styles.photoIcon}>📷</Text>
        <Text style={styles.photoTitle}>Take or upload a photo</Text>
        <Text style={styles.photoHint}>Coming soon on mobile</Text>
      </Pressable>

      <Text style={styles.section}>Or try a sample</Text>
      {SAMPLES.map((s) => (
        <Pressable
          key={s.id}
          style={[styles.sample, selected?.id === s.id && styles.sampleSelected]}
          onPress={() => setSelected(s)}
        >
          <Text style={styles.sampleTitle}>{s.title}</Text>
          <Text style={styles.sampleMeta}>{s.meta}</Text>
          <Text style={styles.sampleTerms}>{s.terms} terms</Text>
        </Pressable>
      ))}

      <Pressable
        style={[styles.primaryBtn, !selected && styles.disabled]}
        disabled={!selected}
        onPress={continueToTriage}
      >
        <Text style={styles.primaryBtnText}>Continue to triage</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 24, paddingTop: 56, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '700', color: '#0f172a' },
  sub: { fontSize: 14, color: '#64748b', marginTop: 8, marginBottom: 24 },
  photoBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#fff',
    marginBottom: 24,
  },
  photoIcon: { fontSize: 32, marginBottom: 8 },
  photoTitle: { fontSize: 15, fontWeight: '600' },
  photoHint: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  section: { fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 12 },
  sample: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sampleSelected: { borderColor: '#0f172a', borderWidth: 2 },
  sampleTitle: { fontSize: 16, fontWeight: '600' },
  sampleMeta: { fontSize: 13, color: '#64748b', marginTop: 4 },
  sampleTerms: { fontSize: 12, color: '#94a3b8', marginTop: 8 },
  primaryBtn: {
    marginTop: 16,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  disabled: { opacity: 0.4 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
