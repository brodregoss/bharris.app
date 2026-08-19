import { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  PanResponder,
} from "react-native";
import { theme } from "../theme";

type Props = {
  prompt: string;
  answer: string;
  progress: string;
  onAnswer: (correct: boolean) => void;
};

export function FlashcardFlow({ prompt, answer, progress, onAnswer }: Props) {
  const [flipped, setFlipped] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;

  const flip = () => {
    if (flipped) return;
    Animated.spring(flipAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
    }).start();
    setFlipped(true);
  };

  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });
  const backRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["180deg", "360deg"],
  });

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 20,
      onPanResponderRelease: (_, g) => {
        if (!flipped) {
          if (g.dx > 60) flip();
          return;
        }
        if (g.dx > 80) onAnswer(true);
        else if (g.dx < -80) onAnswer(false);
      },
    }),
  ).current;

  const handleAnswer = (correct: boolean) => {
    flipAnim.setValue(0);
    setFlipped(false);
    onAnswer(correct);
  };

  return (
    <View style={styles.wrap} {...panResponder.panHandlers}>
      <Text style={styles.progress}>{progress}</Text>
      <Pressable onPress={flip} style={styles.cardArea}>
        <Animated.View
          style={[
            styles.card,
            styles.cardFront,
            { transform: [{ rotateY: frontRotate }] },
            flipped && styles.hidden,
          ]}
        >
          <Text style={styles.label}>TERM</Text>
          <Text style={styles.prompt}>{prompt}</Text>
          <Text style={styles.hint}>Tap or swipe right to reveal</Text>
        </Animated.View>
        <Animated.View
          style={[
            styles.card,
            styles.cardBack,
            { transform: [{ rotateY: backRotate }] },
            !flipped && styles.hidden,
          ]}
        >
          <Text style={styles.label}>ANSWER</Text>
          <Text style={styles.answer}>{answer}</Text>
        </Animated.View>
      </Pressable>

      {flipped && (
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionBtn, styles.missedBtn]}
            onPress={() => handleAnswer(false)}
          >
            <Text style={styles.actionText}>Missed it</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.gotBtn]}
            onPress={() => handleAnswer(true)}
          >
            <Text style={styles.actionText}>Got it</Text>
          </Pressable>
        </View>
      )}
      {flipped && (
        <Text style={styles.swipeHint}>Or swipe right = got it · left = missed</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: theme.spacing.md },
  progress: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: "center",
    marginBottom: theme.spacing.md,
    textTransform: "uppercase",
  },
  cardArea: { flex: 1, justifyContent: "center", minHeight: 280 },
  card: {
    position: "absolute",
    left: 0,
    right: 0,
    borderRadius: theme.radii.card,
    padding: theme.spacing.lg,
    minHeight: 260,
    justifyContent: "center",
    backfaceVisibility: "hidden",
  },
  cardFront: { backgroundColor: theme.colors.cardFront },
  cardBack: { backgroundColor: theme.colors.cardBack },
  hidden: { opacity: 0 },
  label: { ...theme.typography.label, color: theme.colors.textDim, marginBottom: theme.spacing.sm },
  prompt: { ...theme.typography.title, color: theme.colors.text, textAlign: "center" },
  answer: { ...theme.typography.body, color: theme.colors.text, lineHeight: 24, textAlign: "center" },
  hint: { ...theme.typography.caption, color: theme.colors.textDim, textAlign: "center", marginTop: theme.spacing.lg },
  actions: { flexDirection: "row", gap: theme.spacing.md, marginTop: theme.spacing.lg },
  actionBtn: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: theme.radii.lg,
    alignItems: "center",
  },
  missedBtn: { backgroundColor: theme.colors.dangerBg, borderWidth: 1, borderColor: theme.colors.danger },
  gotBtn: { backgroundColor: theme.colors.successBg, borderWidth: 1, borderColor: theme.colors.success },
  actionText: { ...theme.typography.heading, color: theme.colors.text },
  swipeHint: {
    ...theme.typography.caption,
    color: theme.colors.textDim,
    textAlign: "center",
    marginTop: theme.spacing.sm,
  },
});
