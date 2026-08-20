import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { colors, radii } from '@/src/theme';

type Props = {
  value: string | null;
  onChange: (v: string) => void;
};

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
const PERIODS = ['AM', 'PM'];

function parseValue(value: string | null) {
  if (!value) return { hour: 10, minute: '00', period: 'PM' as const };
  const [h24, m] = value.split(':').map(Number);
  const period = h24 >= 12 ? 'PM' : 'AM';
  let hour = h24 % 12;
  if (hour === 0) hour = 12;
  return { hour, minute: String(m).padStart(2, '0'), period };
}

function to24(hour: number, minute: string, period: string) {
  let h = hour % 12;
  if (period === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${minute}`;
}

function ScrollPicker({
  values,
  selected,
  onSelect,
}: {
  values: string[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.picker}>
      {values.map((v) => (
        <Pressable
          key={v}
          onPress={() => onSelect(v)}
          style={[styles.chip, selected === v && styles.chipActive]}
        >
          <Text style={[styles.chipText, selected === v && styles.chipTextActive]}>{v}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function SleepTimePicker({ value, onChange }: Props) {
  const parsed = parseValue(value);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [period, setPeriod] = useState(parsed.period);

  const update = (h: number, m: string, p: string) => {
    setHour(h);
    setMinute(m);
    setPeriod(p);
    onChange(to24(h, m, p));
  };

  return (
    <View style={styles.row}>
      <ScrollPicker values={HOURS.map(String)} selected={String(hour)} onSelect={(v) => update(Number(v), minute, period)} />
      <Text style={styles.sep}>:</Text>
      <ScrollPicker values={MINUTES} selected={minute} onSelect={(v) => update(hour, v, period)} />
      <ScrollPicker values={PERIODS} selected={period} onSelect={(v) => update(hour, minute, v)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
  sep: { fontSize: 24, fontWeight: '600' },
  picker: { maxWidth: 100 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 6,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.slate900, borderColor: colors.slate900 },
  chipText: { fontSize: 18, fontWeight: '500' },
  chipTextActive: { color: '#fff' },
});
