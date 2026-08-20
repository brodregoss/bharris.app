import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { AlertTriangle, ArrowRight } from 'lucide-react-native';
import { Button } from '@/src/components/ui/Button';
import type { StudyTerm } from '@/src/core/types';
import { colors, radii } from '@/src/theme';

type Props = {
  terms: StudyTerm[];
  behind: boolean;
  onUpdateTerm: (id: string, patch: Partial<StudyTerm>) => void;
  onDone: () => void;
};

export function PassiveSkim({ terms, behind, onUpdateTerm, onDone }: Props) {
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSeenIds((prev) => new Set(prev).add(id));
    onUpdateTerm(id, { seen: true });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Passive skim</Text>
      <Text style={styles.sub}>Quick exposure — no grading. Tap to mark seen.</Text>
      {behind && (
        <View style={styles.warn}>
          <AlertTriangle size={16} color={colors.amber800} />
          <Text style={styles.warnText}>
            Running a bit behind — trimming your passive review to keep practice test time safe.
          </Text>
        </View>
      )}
      <ScrollView style={styles.list} contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
        {terms.map((t) => {
          const seen = seenIds.has(t.id) || t.seen;
          return (
            <Pressable
              key={t.id}
              onPress={() => toggle(t.id)}
              style={[styles.item, seen && styles.itemSeen]}
            >
              <Text style={styles.itemTerm}>{t.term}</Text>
              <Text style={styles.itemDef}>{t.definition}</Text>
            </Pressable>
          );
        })}
        {terms.length === 0 && (
          <Text style={styles.empty}>Nothing to skim — nice.</Text>
        )}
      </ScrollView>
      <Button label="Continue" onPress={onDone} icon={<ArrowRight size={16} color="#fff" />} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  sub: { fontSize: 12, color: colors.muted, marginTop: 4, marginBottom: 12 },
  warn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.amber50,
    borderWidth: 1,
    borderColor: colors.amber200,
    borderRadius: radii.lg,
    padding: 12,
    marginBottom: 12,
  },
  warnText: { flex: 1, fontSize: 12, color: colors.amber800, lineHeight: 18 },
  list: { flex: 1, marginBottom: 12 },
  item: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 12,
    backgroundColor: colors.card,
  },
  itemSeen: { borderColor: colors.emerald400, backgroundColor: colors.emerald50 },
  itemTerm: { fontSize: 14, fontWeight: '600' },
  itemDef: { fontSize: 12, color: colors.muted, marginTop: 4 },
  empty: { textAlign: 'center', color: colors.muted, paddingVertical: 32 },
});
