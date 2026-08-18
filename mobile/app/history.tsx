import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

export default function HistoryScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Past sessions</Text>
      <Text style={styles.sub}>
        Session history on mobile is coming soon. Your current in-progress session is saved
        automatically and available from the home screen.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24, paddingTop: 56 },
  back: { marginBottom: 16 },
  backText: { color: '#2563eb', fontSize: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  sub: { fontSize: 15, color: '#64748b', lineHeight: 22 },
});
