import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, History } from 'lucide-react-native';
import { colors } from '@/src/theme';

export default function HistoryScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Back">
          <ArrowLeft size={20} color={colors.foreground} />
        </Pressable>
        <Text style={styles.title}>Past sessions</Text>
      </View>
      <View style={styles.empty}>
        <History size={32} color={colors.mutedLight} />
        <Text style={styles.emptyText}>No past sessions yet.</Text>
        <Text style={styles.emptySub}>Completed crams will show up here.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingTop: 8 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emptyText: { fontSize: 14, color: colors.muted, marginTop: 12 },
  emptySub: { fontSize: 12, color: colors.mutedLight, marginTop: 4 },
});
