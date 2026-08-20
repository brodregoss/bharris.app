import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Home, Clock, Brain } from 'lucide-react-native';
import { useState } from 'react';
import { fmtTime } from '@/src/core/studyUtils';
import { colors } from '@/src/theme';

type Props = {
  readiness: number;
  timeRemainingMs: number;
  blockLabel: string;
};

export function StudyHeader({ readiness, timeRemainingMs, blockLabel }: Props) {
  const router = useRouter();
  const [showTip, setShowTip] = useState(false);

  return (
    <View style={styles.header}>
      <Pressable style={styles.home} onPress={() => router.replace('/')}>
        <Home size={16} color="#fff" />
      </Pressable>
      <View style={styles.center}>
        <Text style={styles.blockLabel} numberOfLines={1}>
          {blockLabel || 'Study session'}
        </Text>
        <Text style={styles.appName}>Last Minute Study</Text>
      </View>
      <View style={styles.stats}>
        <Pressable style={styles.readiness} onPress={() => setShowTip(true)}>
          <Brain size={14} color={colors.emerald600} />
          <Text style={styles.readinessText}>{readiness}%</Text>
        </Pressable>
        <View style={styles.timer}>
          <Clock size={14} color={colors.muted} />
          <Text style={styles.timerText}>{fmtTime(timeRemainingMs)}</Text>
        </View>
      </View>
      <Modal visible={showTip} transparent animationType="fade" onRequestClose={() => setShowTip(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowTip(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Readiness score</Text>
            <Text style={styles.modalBody}>
              How ready you are for the exam, based on how well you've recalled each term so far this session.
            </Text>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  home: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.slate900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, minWidth: 0 },
  blockLabel: { fontSize: 11, color: colors.muted },
  appName: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  readiness: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  readinessText: { fontSize: 14, fontWeight: '700' },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timerText: { fontSize: 14, fontWeight: '600' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    padding: 32,
  },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  modalTitle: { fontWeight: '700', marginBottom: 6 },
  modalBody: { fontSize: 13, color: colors.muted, lineHeight: 20 },
});
