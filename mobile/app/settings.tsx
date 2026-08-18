import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { isBase44Configured } from '@/src/services/base44Client';

export default function SettingsScreen() {
  const router = useRouter();
  const aiOk = isBase44Configured();

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>AI (Base44)</Text>
        <Text style={[styles.status, aiOk ? styles.ok : styles.bad]}>
          {aiOk ? 'Configured' : 'Missing — add mobile/.env credentials'}
        </Text>
        <Text style={styles.hint}>
          Triage and panic notes use Base44 InvokeLLM. If you stopped paying, AI calls may fail
          with billing errors (not crypto errors).
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Development</Text>
        <Text style={styles.hint}>
          Run npm start in the mobile folder, press i for iOS Simulator. Xcode is only needed for
          App Store builds or custom native code.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24, paddingTop: 56 },
  back: { marginBottom: 16 },
  backText: { color: '#2563eb', fontSize: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 20 },
  card: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  status: { fontWeight: '600', marginBottom: 8 },
  ok: { color: '#16a34a' },
  bad: { color: '#dc2626' },
  hint: { fontSize: 13, color: '#64748b', lineHeight: 20 },
});
