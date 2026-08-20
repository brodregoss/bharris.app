import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, radii } from '@/src/theme';

type Props = {
  icon?: React.ReactNode;
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
};

export function BrandHeader({ icon, title = 'Last Minute Study', subtitle, right }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.badge}>{icon}</View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function IconButton({ children, onPress, accessibilityLabel }: {
  children: React.ReactNode;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    backgroundColor: colors.slate900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', color: colors.foreground, letterSpacing: -0.3 },
  subtitle: { fontSize: 11, color: colors.muted, marginTop: 2 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
