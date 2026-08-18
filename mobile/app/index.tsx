import { StyleSheet, Text, View, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  loadSession,
  loadFinishedSession,
  isOnboarded,
} from '@/src/services/sessionStore';
import type { SessionData } from '@/src/core/types';

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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0f172a" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.push('/history')} style={styles.iconBtn}>
          <Text style={styles.iconText}>↺</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/settings')} style={styles.settingsBtn}>
          <Text style={styles.settingsText}>⚙</Text>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Text style={styles.moon}>🌙</Text>
        <Text style={styles.title}>Last Minute Study</Text>
        <Text style={styles.subtitle}>Cram smarter, not harder</Text>
      </View>

      <View style={styles.actions}>
        {session ? (
          <Pressable style={styles.primaryBtn} onPress={() => router.push('/study')}>
            <Text style={styles.primaryBtnText}>Continue cram</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.primaryBtn} onPress={() => router.push('/setup')}>
            <Text style={styles.primaryBtnText}>Start a cram session</Text>
          </Pressable>
        )}

        {finished && (
          <>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => router.push({ pathname: '/study', params: { restart: '1' } })}
            >
              <Text style={styles.secondaryBtnText}>Restart last cram</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 24, paddingTop: 56 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 48 },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#64748b' },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsText: { color: '#fff', fontSize: 18 },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  moon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 8 },
  actions: { paddingBottom: 48, gap: 12 },
  primaryBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  secondaryBtnText: { color: '#0f172a', fontSize: 16, fontWeight: '600' },
});
