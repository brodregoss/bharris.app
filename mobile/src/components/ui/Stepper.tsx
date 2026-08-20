import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, radii, shadows } from '@/src/theme';

type Props = {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  step?: number;
  suffix?: string;
};

export function Stepper({ value, onChange, min = 0, step = 1, suffix }: Props) {
  const set = (n: number) => onChange(Math.max(min, Math.round(n)));
  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => set(value - step)} style={styles.btn} accessibilityLabel="decrease">
        <Text style={styles.btnText}>−</Text>
      </Pressable>
      <Text style={styles.value}>
        {value}
        {suffix ? ` ${suffix}` : ''}
      </Text>
      <Pressable onPress={() => set(value + step)} style={styles.btn} accessibilityLabel="increase">
        <Text style={styles.btnText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    overflow: 'hidden',
    ...shadows.card,
  },
  btn: { paddingHorizontal: 16, paddingVertical: 14 },
  btnText: { fontSize: 24, fontWeight: '300', color: colors.muted },
  value: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '600', color: colors.foreground },
});
