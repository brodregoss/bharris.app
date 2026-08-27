import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, FileText, RefreshCw, Loader2 } from 'lucide-react-native';
import { PanicMarkdown } from '@/src/components/ui/PanicMarkdown';
import { generatePanicNotes } from '@/src/services/aiService';
import {
  loadSession,
  loadPanicSummary,
  savePanicSummary,
  panicSignature,
} from '@/src/services/sessionStore';
import { Button } from '@/src/components/ui/Button';
import { colors, radii, shadows } from '@/src/theme';

export default function PanicScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(false);
  const [summary, setSummary] = useState<{ signature: string; text: string } | null>(null);
  const [termsJson, setTermsJson] = useState<string | null>(null);
  const [currentSig, setCurrentSig] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const session = await loadSession();
      if (!session?.terms?.length) {
        setLoading(false);
        return;
      }
      const payload = session.terms
        .filter((t) => t.tier === 'critical' || t.tier === 'core')
        .map((t) => ({
          term: t.term,
          definition: t.definition,
          tier: t.tier,
          confidence: t.confidence,
          missed: (t.recallHistory || []).filter((h) => h.result === 'missed').length,
          tested: t.testResult,
          depends_on: t.depends_on || [],
        }));
      const json = JSON.stringify(payload);
      const sig = panicSignature(session.terms);
      setTermsJson(json);
      setCurrentSig(sig);
      const cached = await loadPanicSummary();
      if (cached?.signature === sig) setSummary(cached);
      else if (cached) setSummary(cached);
      setLoading(false);
    })();
  }, []);

  const generate = async () => {
    if (!termsJson || !currentSig) return;
    setGenerating(true);
    setError(false);
    try {
      const notes = await generatePanicNotes(termsJson);
      await savePanicSummary(currentSig, notes);
      setSummary({ signature: currentSig, text: notes });
    } catch {
      setError(true);
    }
    setGenerating(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.slate900} />
      </View>
    );
  }

  if (!termsJson) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.empty}>No terms to review yet.</Text>
        <Button label="Back to start" onPress={() => router.replace('/')} />
      </SafeAreaView>
    );
  }

  const hasSummary = !!summary?.text;
  const isStale = hasSummary && summary.signature !== currentSig;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Pressable style={styles.close} onPress={() => router.back()} accessibilityLabel="Exit">
        <X size={20} color={colors.muted} />
      </Pressable>

      <ScrollView contentContainerStyle={styles.content}>
        {!hasSummary && !generating && (
          <View style={styles.promptCard}>
            <View style={styles.promptIcon}>
              <FileText size={20} color={colors.rose600} />
            </View>
            <Text style={styles.promptTitle}>Generate your panic notes?</Text>
            <Text style={styles.promptSub}>
              A one-page summary of what to know — built from your terms, weakest concepts first.
            </Text>
            <Button label="Generate notes" onPress={generate} icon={<FileText size={16} color="#fff" />} />
          </View>
        )}

        {generating && (
          <View style={styles.generating}>
            <Loader2 size={28} color={colors.muted} />
            <Text style={styles.generatingText}>Writing your notes…</Text>
          </View>
        )}

        {hasSummary && isStale && !generating && (
          <View style={styles.staleBanner}>
            <RefreshCw size={16} color={colors.amber700} />
            <Text style={styles.staleText}>Your terms changed since these notes were made.</Text>
            <Pressable onPress={generate} style={styles.staleBtn}>
              <Text style={styles.staleBtnText}>Regenerate</Text>
            </Pressable>
          </View>
        )}

        {hasSummary && !generating && (
          <View style={styles.article}>
            <PanicMarkdown text={summary.text} />
          </View>
        )}

        {error && !generating && (
          <Text style={styles.error}>Couldn't generate notes — try again.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  empty: { fontSize: 14, color: colors.muted, marginBottom: 16 },
  promptCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 24,
    alignItems: 'center',
    ...shadows.card,
  },
  promptIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.lg,
    backgroundColor: colors.rose50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  promptTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  promptSub: { fontSize: 14, color: colors.muted, textAlign: 'center', marginBottom: 20 },
  generating: { alignItems: 'center', paddingVertical: 64 },
  generatingText: { fontSize: 14, color: colors.muted, marginTop: 12 },
  staleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.amber50,
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: radii.lg,
    padding: 12,
    marginBottom: 16,
  },
  staleText: { flex: 1, fontSize: 12, color: colors.amber800 },
  staleBtn: {
    borderWidth: 1,
    borderColor: '#fbbf24',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  staleBtnText: { fontSize: 12, color: colors.amber700, fontWeight: '600' },
  article: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 20,
    ...shadows.card,
  },
  error: { fontSize: 14, color: colors.rose600, textAlign: 'center', marginTop: 16 },
});
