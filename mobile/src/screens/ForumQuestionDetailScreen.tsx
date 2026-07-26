// PRD §12 — Forum question detail screen: shows the full question + all answers + reply form.
import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import {
  fetchForumQuestion,
  answerForumQuestion,
  deleteForumQuestion,
  deleteForumAnswer,
  ForumQuestion,
  ForumAnswer,
} from "../lib/api";
import { theme } from "../lib/theme";
import { Card, EmptyState, ErrorState } from "../components/ui";

export function ForumQuestionDetailScreen({
  questionId,
  initialQuestion,
}: {
  questionId: string;
  initialQuestion?: ForumQuestion;
}) {
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
      setQuestion((prev) =>
        prev ? { ...prev, answers: [...(prev.answers ?? []), answer] } : prev
      );
      setAnswerBody("");
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to post answer");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteQuestion() {
    if (!token || !question) return;
    Alert.alert("Delete Question", "Are you sure? This will also delete all answers.", [
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
    Alert.alert("Delete Answer", "Remove this answer?", [
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
      <View style={styles.centered}>
        <ActivityIndicator color={theme.color.primary} size="large" />
      </View>
    );
  }

  if (error && !question) {
    return <ErrorState message={error} onRetry={loadQuestion} />;
  }

  if (!question) return null;

  const isModerator = user?.role === "ADMIN" || user?.role === "STAFF";
  const isAuthor = question.author.id === user?.id;
  const canDelete = isModerator || isAuthor;
  const answers = question.answers ?? [];

  return (
    <FlatList
      data={answers}
      keyExtractor={(a) => a.id}
      contentContainerStyle={styles.container}
      ListEmptyComponent={<EmptyState title="No answers yet" subtitle="Be the first to answer!" />}
      ListHeaderComponent={
        <View>
          <Card style={styles.questionCard}>
            <Text style={styles.questionTitle}>{question.title}</Text>
            <Text style={styles.questionBody}>{question.body}</Text>
            <View style={styles.meta}>
              <Text style={styles.metaText}>{question.author.name ?? "User"}</Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaText}>{new Date(question.createdAt).toLocaleDateString()}</Text>
            </View>
            {canDelete && (
              <Pressable onPress={handleDeleteQuestion} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>Delete Question</Text>
              </Pressable>
            )}
          </Card>
          <Text style={styles.answersHeader}>
            {answers.length} Answer{answers.length !== 1 ? "s" : ""}
          </Text>
        </View>
      }
      ListFooterComponent={
        <View style={styles.replyBox}>
          <Text style={styles.replyLabel}>Your Answer</Text>
          <TextInput
            style={styles.replyInput}
            placeholder="Write your answer…"
            placeholderTextColor={theme.color.textSecondary}
            value={answerBody}
            onChangeText={setAnswerBody}
            multiline
            maxLength={5000}
            textAlignVertical="top"
          />
          <Pressable
            style={[styles.submitBtn, !answerBody.trim() && styles.submitDisabled]}
            onPress={handleAnswer}
            disabled={isSubmitting || !answerBody.trim()}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Post Answer</Text>
            )}
          </Pressable>
        </View>
      }
      renderItem={({ item }: { item: ForumAnswer }) => {
        const canDeleteAnswer = isModerator || item.author.id === user?.id;
        return (
          <Card style={styles.answerCard}>
            <Text style={styles.answerBody}>{item.body}</Text>
            <View style={styles.meta}>
              <Text style={styles.metaText}>{item.author.name ?? "User"}</Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaText}>{new Date(item.createdAt).toLocaleDateString()}</Text>
              {canDeleteAnswer && (
                <>
                  <Text style={styles.metaDot}>·</Text>
                  <Pressable onPress={() => handleDeleteAnswer(item.id)}>
                    <Text style={[styles.metaText, styles.deleteText]}>Delete</Text>
                  </Pressable>
                </>
              )}
            </View>
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.color.background },
  container: { padding: theme.spacing.lg, backgroundColor: theme.color.background },
  questionCard: { marginBottom: theme.spacing.lg },
  questionTitle: { fontSize: 18, fontWeight: "700", color: theme.color.textPrimary, marginBottom: 8 },
  questionBody: { fontSize: 14, color: theme.color.textPrimary, lineHeight: 22, marginBottom: 10 },
  answersHeader: { fontSize: 14, fontWeight: "600", color: theme.color.textSecondary, marginBottom: theme.spacing.sm },
  answerCard: { marginBottom: theme.spacing.md },
  answerBody: { fontSize: 14, color: theme.color.textPrimary, lineHeight: 22, marginBottom: 8 },
  meta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 },
  metaText: { fontSize: 12, color: theme.color.textSecondary },
  metaDot: { fontSize: 12, color: theme.color.textSecondary },
  deleteBtn: { marginTop: 10 },
  deleteBtnText: { fontSize: 12, color: theme.color.danger },
  deleteText: { color: theme.color.danger },
  replyBox: {
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
  replyLabel: { fontSize: 14, fontWeight: "600", color: theme.color.textPrimary, marginBottom: theme.spacing.sm },
  replyInput: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: 14,
    color: theme.color.textPrimary,
    backgroundColor: theme.color.surface,
    marginBottom: theme.spacing.md,
    minHeight: 100,
  },
  submitBtn: {
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius,
    paddingVertical: theme.spacing.md,
    alignItems: "center",
  },
  submitDisabled: { opacity: 0.5 },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
