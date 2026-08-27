import { Text, View, StyleSheet } from 'react-native';
import { colors } from '@/src/theme';

type Segment = { text: string; bold: boolean };

function parseInline(line: string): Segment[] {
  const parts: Segment[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(line))) {
    if (match.index > last) {
      parts.push({ text: line.slice(last, match.index), bold: false });
    }
    parts.push({ text: match[1], bold: true });
    last = match.index + match[0].length;
  }
  if (last < line.length) parts.push({ text: line.slice(last), bold: false });
  return parts.length ? parts : [{ text: line, bold: false }];
}

function Inline({ line }: { line: string }) {
  return (
    <Text>
      {parseInline(line).map((seg, i) => (
        <Text key={i} style={seg.bold ? styles.strong : undefined}>
          {seg.text}
        </Text>
      ))}
    </Text>
  );
}

export function PanicMarkdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: { type: 'h1' | 'h2' | 'h3' | 'p' | 'li'; text: string }[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    if (line.startsWith('### ')) blocks.push({ type: 'h3', text: line.slice(4) });
    else if (line.startsWith('## ')) blocks.push({ type: 'h2', text: line.slice(3) });
    else if (line.startsWith('# ')) blocks.push({ type: 'h1', text: line.slice(2) });
    else if (/^\s*[-*]\s+/.test(line)) blocks.push({ type: 'li', text: line.replace(/^\s*[-*]\s+/, '') });
    else blocks.push({ type: 'p', text: line.trim() });
  }

  return (
    <View>
      {blocks.map((b, i) => {
        if (b.type === 'h1' || b.type === 'h2') {
          return (
            <Text key={i} style={styles.h2}>
              <Inline line={b.text} />
            </Text>
          );
        }
        if (b.type === 'h3') {
          return (
            <Text key={i} style={styles.h3}>
              <Inline line={b.text} />
            </Text>
          );
        }
        if (b.type === 'li') {
          return (
            <View key={i} style={styles.liRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.body}>
                <Inline line={b.text} />
              </Text>
            </View>
          );
        }
        return (
          <Text key={i} style={styles.p}>
            <Inline line={b.text} />
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  h2: { fontSize: 16, fontWeight: '700', marginTop: 16, marginBottom: 6, color: colors.foreground },
  h3: { fontSize: 14, fontWeight: '700', marginTop: 12, marginBottom: 4, color: colors.foreground },
  p: { fontSize: 14, lineHeight: 22, marginBottom: 10, color: colors.foreground },
  body: { flex: 1, fontSize: 14, lineHeight: 22, color: colors.foreground },
  liRow: { flexDirection: 'row', gap: 8, marginBottom: 4, paddingLeft: 8 },
  bullet: { fontSize: 14, lineHeight: 22, color: colors.foreground },
  strong: { fontWeight: '600' },
});
