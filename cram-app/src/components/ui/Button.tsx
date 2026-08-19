import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, radii, shadows } from '@/src/theme';

type Props = PressableProps & {
  label: string;
  variant?: 'primary' | 'secondary' | 'outlineMiss' | 'gotIt' | 'muted';
  icon?: React.ReactNode;
  textStyle?: TextStyle;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  variant = 'primary',
  icon,
  disabled,
  textStyle,
  style,
  ...rest
}: Props) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
      disabled={disabled}
      {...rest}
    >
      {icon}
      <Text style={[styles.text, styles[`${variant}Text` as keyof typeof styles] as TextStyle, textStyle]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.button,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  primary: {
    backgroundColor: colors.slate900,
    ...shadows.button,
  },
  secondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  outlineMiss: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.rose400,
  },
  gotIt: {
    backgroundColor: colors.emerald600,
  },
  muted: {
    backgroundColor: colors.slate100,
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.9 },
  text: { fontSize: 16, fontWeight: '600' },
  primaryText: { color: '#fff' },
  secondaryText: { color: colors.foreground },
  outlineMissText: { color: colors.rose600 },
  gotItText: { color: '#fff' },
  mutedText: { color: colors.muted },
});
