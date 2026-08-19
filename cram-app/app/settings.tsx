import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Moon } from 'lucide-react-native';
import { colors, radii } from '@/src/theme';

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Back">
          <ArrowLeft size={20} color={colors.foreground} />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Moon size={16} color={colors.muted} />
            <Text style={styles.cardTitle}>Why we ask when you're sleeping</Text>
          </View>
          <Text style={styles.cardBody}>
            Your brain does real work locking in what you studied while you sleep — this is called memory
            consolidation. Cramming more new material in the last 30–45 minutes before bed usually doesn't help,
            and can even cost you sleep that would have helped more. So once you're close to your stop time, we
            stop introducing new material and just help you review what's already shaky.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingTop: 8 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '700' },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 20,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  cardBody: { fontSize: 12, color: colors.muted, lineHeight: 20 },
});
