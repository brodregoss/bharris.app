import { View, Text, StyleSheet } from 'react-native';
import { CheckCircle2, ArrowRight } from 'lucide-react-native';
import { Button } from '@/src/components/ui/Button';
import { colors, radii } from '@/src/theme';

type Props = {
  title: string;
  message: string;
  onContinue: () => void;
  continueLabel?: string;
};

export function BlockSummary({ title, message, onContinue, continueLabel = 'Continue' }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <CheckCircle2 size={28} color={colors.emerald600} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <Button
        label={continueLabel}
        onPress={onContinue}
        icon={<ArrowRight size={16} color="#fff" />}
        style={styles.btn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.emerald50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  message: { fontSize: 14, color: colors.muted, textAlign: 'center', marginBottom: 32, maxWidth: 320 },
  btn: { paddingHorizontal: 32, minWidth: 200 },
});
