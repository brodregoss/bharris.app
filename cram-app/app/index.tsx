import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Timer, History, Settings, ArrowRight, RotateCcw } from 'lucide-react-native';
import {
  loadSession,
  loadFinishedSession,
  isOnboarded,
  saveStudyBootstrap,
} from '@/src/services/sessionStore';
import { Button } from '@/src/components/ui/Button';
import { IconButton } from '@/src/components/ui/BrandHeader';
import type { SessionData } from '@/src/core/types';
import { colors, radii, shadows } from '@/src/theme';

export default function LandingScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionData | null>(null);
  const [finished, setFinished] = useState<SessionData | null>(null);

  const bootstrap = useCallback(async () => {
    const [s, f, onboarded] = await Promise.all([
      loadSession(),
      loadFinishedSession(),
      isOnboarded(),
    ]);
    if (!onboarded && !s) {
      router.replace('/setup');
      return;
    }
    setSession(s);
    setFinished(f);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const restartCram = async () => {
    if (!finished) return;
    const resetTerms = finished.terms.map((t) => ({
      ...t,
      recallHistory: [],
      correctStreak: 0,
      seen: false,
      testResult: null,
    }));
    await saveStudyBootstrap({ terms: resetTerms, setup: finished.setup, resetState: false });
    router.push('/study');
  };

  const practice = async () => {
    if (!finished) return;
    await saveStudyBootstrap({
      terms: finished.terms,
      setup: finished.setup,
      initialPhase: 'test',
      resetState: false,
    });
    router.push('/study');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.slate900} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton onPress={() => router.push('/history')} accessibilityLabel="Past sessions">
          <History size={20} color={colors.muted} />
        </IconButton>
        <IconButton onPress={() => router.push('/settings')} accessibilityLabel="Settings">
          <Settings size={20} color={colors.muted} />
        </IconButton>
      </View>

      <View style={styles.hero}>
        <View style={styles.logo}>
          <Timer size={28} color="#fff" />
        </View>
        <Text style={styles.title}>Last Minute Study</Text>
        <Text style={styles.subtitle}>Ready when you are.</Text>
        {session && (
          <Pressable onPress={() => router.push('/panic')}>
            <Text style={styles.panicLink}>panic notes</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.footer}>
        {session ? (
          <>
            <Button
              label="Continue session"
              onPress={() => router.push('/study')}
              icon={<RotateCcw size={18} color="#fff" />}
              style={styles.primaryCta}
              textStyle={styles.primaryCtaText}
            />
            <Pressable onPress={() => router.push('/setup')}>
              <Text style={styles.textLink}>Start new cram</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Button
              label="Start new cram"
              onPress={() => router.push('/setup')}
              icon={<ArrowRight size={18} color="#fff" />}
              style={styles.primaryCta}
              textStyle={styles.primaryCtaText}
            />
            {finished && (
              <View style={styles.finishedRow}>
                <Pressable onPress={restartCram}>
                  <Text style={styles.textLink}>restart cram?</Text>
                </Pressable>
                <Text style={styles.dot}>·</Text>
                <Pressable onPress={practice}>
                  <Text style={styles.textLink}>practice</Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  logo: {
    width: 56,
    height: 56,
    borderRadius: radii.xl,
    backgroundColor: colors.slate900,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 4 },
  panicLink: { fontSize: 14, color: colors.muted, marginTop: 12, textDecorationLine: 'underline' },
  footer: { paddingHorizontal: 24, paddingBottom: 24, gap: 12, alignItems: 'stretch' },
  primaryCta: { height: 64, borderRadius: radii.xl, ...shadows.button },
  primaryCtaText: { fontSize: 18, fontWeight: '700' },
  textLink: { fontSize: 14, color: colors.muted, textAlign: 'center', textDecorationLine: 'underline' },
  finishedRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 4 },
  dot: { color: colors.mutedLight },
});
