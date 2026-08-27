import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { colors, radii, shadows } from '@/src/theme';

type Option = { value: string; label: string };

type Props = {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder: string;
};

export function SelectField({ value, onChange, options, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => setOpen(true)}>
        <Text style={[styles.triggerText, !selected && styles.placeholder]}>
          {selected?.label ?? placeholder}
        </Text>
        <ChevronDown size={18} color={colors.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <ScrollView>
              {options.map((o) => (
                <Pressable
                  key={o.value}
                  style={[styles.option, value === o.value && styles.optionActive]}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.optionText, value === o.value && styles.optionTextActive]}>
                    {o.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    height: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.card,
  },
  triggerText: { fontSize: 16, color: colors.foreground },
  placeholder: { color: colors.muted },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
    paddingBottom: 24,
  },
  option: { paddingVertical: 16, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: colors.border },
  optionActive: { backgroundColor: colors.slate50 },
  optionText: { fontSize: 16, color: colors.foreground },
  optionTextActive: { fontWeight: '700' },
});
