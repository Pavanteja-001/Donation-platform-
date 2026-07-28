// PRD §12 — Forum question detail: the full question, its answers, and a reply form.
import { useState, useCallback, useEffect } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import {
  fetchForumQuestion,
  answerForumQuestion,
  deleteForumQuestion,
  deleteForumAnswer,
  type ForumQuestion,
  type ForumAnswer,
} from "../lib/api";
import { theme } from "../lib/theme";
import { timeAgo } from "../lib/needMeta";
import { Avatar, Badge, Button, EmptyState, ErrorState, Input, Skeleton, PressableScale } from "../components/ui";
import { Gradient } from "../components/Gradient";

function DetailSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <View style={[styles.card, theme.elevation.level2, { gap: theme.spacing.md }]}>
        <Skeleton width="90%" height={24} />
        <Skeleton width="100%" height={14} />
        <Skeleton width="95%" height={14} />
        <Skeleton width="60%" height={14} />
      </View>
      {[0, 1].map((i) => (
        <View key={i} style={[styles.card, theme.elevation.level1, { gap: theme.spacing.sm }]}>
          <Skeleton width={120} height={20} radius={theme.radii.pill} />
          <Skeleton width="100%" height={13} />
          <Skeleton width="80%" height={13} />
        </View>
      ))}
    </View>
  );
}

export function ForumQuestionDetailScreen({
  questionId,
  initialQuestion,
}: {
  questionId: string;
  initialQuestion?: ForumQuestion;
}) {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const navigation = useNavigation<any>();
  const [question, setQuestion] = useState<ForumQuestion | null>(initialQuestion ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [answerBody, setAnswerBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadQuestion = useCallback(async () => {
    if (!token) return;
    try {
      const { question: q } = await fetchForumQuestion(token, questionId);
      setQuestion(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load question");
    } finally {
      setIsLoading(false);
    }
  }, [token, questionId]);

  // Load full details (with all answers) on mount.
  useEffect(() => {
    loadQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAnswer() {
    if (!token || !answerBody.trim()) return;
    setIsSubmitting(true);
    try {
      const { answer } = await answerForumQuestion(token, questionId, answerBody.trim());
      setQuestion((prev) => (prev ? { ...prev, answers: [...(prev.answers ?? []), answer] } : prev));
      setAnswerBody("");
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to post answer");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteQuestion() {
    if (!token || !question) return;
    Alert.alert("Delete question", "Are you sure? This will also delete all answers.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteForumQuestion(token, question.id);
            navigation.goBack();
          } catch (err) {
            Alert.alert("Error", err instanceof Error ? err.message : "Failed to delete");
          }
        },
      },
    ]);
  }

  async function handleDeleteAnswer(answerId: string) {
    if (!token) return;
    Alert.alert("Delete answer", "Remove this answer?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteForumAnswer(token, answerId);
            setQuestion((prev) =>
              prev ? { ...prev, answers: (prev.answers ?? []).filter((a) => a.id !== answerId) } : prev
            );
          } catch (err) {
            Alert.alert("Error", err instanceof Error ? err.message : "Failed to delete");
          }
        },
      },
    ]);
  }

  if (isLoading && !question) {
    return (
      <View style={styles.container}>
        <DetailSkeleton />
      </View>
    );
  }

  if (error && !question) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ErrorState message={error} onRetry={loadQuestion} />
      </View>
    );
  }

  if (!question) return null;

  // PRD §12.3 — moderators can remove anything; authors can remove their own.
  const isModerator = user?.role === "ADMIN" || user?.role === "STAFF";
  const isAuthor = question.author.id === user?.id;
  const canDelete = isModerator || isAuthor;
  const answers = question.answers ?? [];
  const asked = timeAgo(question.createdAt);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <FlashList
        data={answers}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <Animated.View entering={FadeInDown.duration(360)} style={[styles.card, theme.elevation.level2]}>
              <Gradient
                colors={theme.gradient.surfaceSheen}
                direction="diagonal"
                style={StyleSheet.absoluteFill as never}
                pointerEvents="none"
              />
              <Text style={styles.questionTitle}>{question.title}</Text>
              <Text style={styles.questionBody}>{question.body}</Text>

              <View style={styles.authorRow}>
                <Avatar name={question.author.name} size={30} />
                <View style={styles.authorText}>
                  <Text style={styles.authorName} numberOfLines={1}>
                    {question.author.name ?? "User"}
                  </Text>
                  {asked && <Text style={styles.authorMeta}>{asked}</Text>}
                </View>
                {canDelete && (
                  <PressableScale
                    onPress={handleDeleteQuestion}
                    hitSlop={8}
                    accessibilityLabel="Delete question"
                    style={styles.deleteIcon}
                  >
                    <Feather name="trash-2" size={15} color={theme.color.danger} />
                  </PressableScale>
                )}
              </View>
            </Animated.View>

            <View style={styles.answersHeaderRow}>
              <Text style={styles.answersHeader}>
                {answers.length} {answers.length === 1 ? "answer" : "answers"}
              </Text>
              {answers.length === 0 && <Badge label="Unanswered" tone="accent" />}
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="message-square"
            title="No answers yet"
            subtitle="If you know something about this, you'd be the first to help."
          />
        }
        renderItem={({ item }: { item: ForumAnswer }) => {
          const canDeleteAnswer = isModerator || item.author.id === user?.id;
          const answered = timeAgo(item.createdAt);
          return (
            <View style={[styles.card, styles.answerCard, theme.elevation.level1]}>
              <Gradient
                colors={theme.gradient.surfaceSheen}
                direction="diagonal"
                style={StyleSheet.absoluteFill as never}
                pointerEvents="none"
              />
              <View style={styles.authorRow}>
                <Avatar name={item.author.name} size={26} />
                <View style={styles.authorText}>
                  <Text style={styles.authorName} numberOfLines={1}>
                    {item.author.name ?? "User"}
                  </Text>
                  {answered && <Text style={styles.authorMeta}>{answered}</Text>}
                </View>
                {canDeleteAnswer && (
                  <PressableScale
                    onPress={() => handleDeleteAnswer(item.id)}
                    hitSlop={8}
                    accessibilityLabel="Delete answer"
                    style={styles.deleteIcon}
                  >
                    <Feather name="trash-2" size={14} color={theme.color.danger} />
                  </PressableScale>
                )}
              </View>
              <Text style={styles.answerBody}>{item.body}</Text>
            </View>
          );
        }}
      />

      {/* Docked composer — an answer form buried under a long answer list is one nobody finds. */}
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}>
        <Input
          placeholder="Write your answer…"
          multiline
          value={answerBody}
          onChangeText={setAnswerBody}
          maxLength={5000}
          containerStyle={styles.composerInput}
        />
        <Button
          label="Post answer"
          icon="send"
          onPress={handleAnswer}
          disabled={!answerBody.trim()}
          loading={isSubmitting}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.background },
  centered: { alignItems: "center", justifyContent: "center", padding: theme.spacing.xl },
  list: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  skeletonWrap: { padding: theme.spacing.lg, gap: theme.spacing.md },

  header: { gap: theme.spacing.lg, marginBottom: theme.spacing.md },
  card: {
    backgroundColor: theme.color.surface,
    // Clips the lit sheen overlay to the card radius.
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.lg,
  },
  answerCard: { marginBottom: theme.spacing.md, gap: theme.spacing.md },

  questionTitle: { ...theme.typography.h2, color: theme.color.textPrimary },
  questionBody: { ...theme.typography.body, color: theme.color.textSecondary, marginTop: theme.spacing.md },

  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.color.borderSubtle,
  },
  authorText: { flex: 1 },
  authorName: { ...theme.typography.caption, fontWeight: "700", color: theme.color.textPrimary },
  authorMeta: { ...theme.typography.caption, color: theme.color.textTertiary },
  deleteIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.color.dangerSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  answersHeaderRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  answersHeader: { ...theme.typography.h3, color: theme.color.textPrimary },
  answerBody: { ...theme.typography.bodySmall, color: theme.color.textPrimary, lineHeight: 21 },

  composer: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    backgroundColor: theme.color.surface,
    borderTopWidth: 1,
    borderTopColor: theme.color.borderSubtle,
  },
  composerInput: { marginBottom: 0 },
});
