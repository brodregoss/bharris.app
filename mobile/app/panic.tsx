import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { generatePanicNotes, formatAiError } from '@/src/services/aiService';
import {
  loadSession,
  loadPanicSummary,
  savePanicSummary,
  panicSignature,
} from '@/src/services/sessionStore';

export default function PanicScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
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
        }));
      const json = JSON.stringify(payload);
      const sig = panicSignature(session.terms);
      setTermsJson(json);
      setCurrentSig(sig);
      const cached = await loadPanicSummary();
      if (cached?.signature === sig) setText(cached.text);
      setSignature(cached?.signature ?? null);
      setLoading(false);
    })();
  }, []);

  const generate = async () => {
    if (!termsJson || !currentSig) return;
    setGenerating(true);
    setError(null);
    try {
      const notes = await generatePanicNotes(termsJson);
      await savePanicSummary(currentSig, notes);
      setText(notes);
      setSignature(currentSig);
    } catch (err) {
      setError(formatAiError(err));
    }
    setGenerating(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!termsJson) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>No terms to review yet.</Text>
        <Pressable style={styles.backBtn} onPress={() => router.replace('/')}>
          <Text style={styles.backBtnText}>Back to start</Text>
        </Pressable>
      </View>
    );
  }

  const isStale = signature && currentSig && signature !== currentSig;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <Text style={styles.title}>Panic review</Text>
        <View style={{ width: 24 }} />
      </View>

      {!text ? (
        <View style={styles.center}>
          <Text style={styles.prompt}>Generate last-minute notes from your weak spots.</Text>
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable style={styles.primaryBtn} onPress={generate} disabled={generating}>
            {generating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Generate notes</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <ScrollView style={styles.notes} contentContainerStyle={styles.notesContent}>
          {isStale && (
            <Pressable style={styles.staleBanner} onPress={generate}>
              <Text style={styles.staleText}>Your progress changed — tap to regenerate</Text>
            </Pressable>
          )}
          <Text style={styles.notesBody}>{text}</Text>
          <Pressable style={styles.secondaryBtn} onPress={generate} disabled={generating}>
            <Text style={styles.secondaryBtnText}>Regenerate</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 56 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  close: { fontSize: 20, color: '#64748b', padding: 8 },
  title: { fontSize: 18, fontWeight: '700' },
  empty: { fontSize: 14, color: '#64748b', marginBottom: 16 },
  prompt: { textAlign: 'center', color: '#64748b', marginBottom: 20 },
  error: { color: '#dc2626', marginBottom: 12, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
    minWidth: 180,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '600' },
  backBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
  },
  backBtnText: { color: '#fff', fontWeight: '600' },
  notes: { flex: 1 },
  notesContent: { padding: 20, paddingBottom: 40 },
  notesBody: { fontSize: 15, lineHeight: 24, color: '#334155' },
  staleBanner: {
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  staleText: { fontSize: 13, color: '#92400e', textAlign: 'center' },
  secondaryBtn: { marginTop: 24, alignItems: 'center', padding: 12 },
  secondaryBtnText: { color: '#2563eb', fontWeight: '600' },
});
