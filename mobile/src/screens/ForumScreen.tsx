// PRD §12 — Community Q&A Forum screen. Lists questions with answer counts; users can ask
// new questions. Pagination via cursor. Tap a question to open the detail screen.
import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import {
  fetchForumQuestions,
  askForumQuestion,
  ForumQuestion,
} from "../lib/api";
import { theme } from "../lib/theme";
import { Card, EmptyState, ErrorState } from "../components/ui";

type Props = { onSelectQuestion: (question: ForumQuestion) => void };

export function ForumScreen({ onSelectQuestion }: Props) {
  const { token } = useAuth();
  const [questions, setQuestions] = useState<ForumQuestion[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAsk, setShowAsk] = useState(false);
  const [askTitle, setAskTitle] = useState("");
  const [askBody, setAskBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(
    async (cursor?: string) => {
      if (!token) return;
      if (!cursor) setIsLoading(true);
      setError(null);
      try {
        const { questions: fetched, nextCursor: nc } = await fetchForumQuestions(token, cursor);
        setQuestions((prev) => (cursor ? [...prev, ...fetched] : fetched));
        setNextCursor(nc);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load forum");
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleAsk() {
    if (!token || !askTitle.trim() || !askBody.trim()) return;
    setIsSubmitting(true);
    try {
      const { question } = await askForumQuestion(token, { title: askTitle.trim(), body: askBody.trim() });
      setQuestions((prev) => [question, ...prev]);
      setAskTitle("");
      setAskBody("");
      setShowAsk(false);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to post question");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading && questions.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.color.primary} size="large" />
      </View>
    );
  }

  if (error && questions.length === 0) {
    return <ErrorState message={error} onRetry={() => load()} />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={questions}
        keyExtractor={(q) => q.id}
        contentContainerStyle={questions.length === 0 ? styles.flex : styles.list}
        ListEmptyComponent={<EmptyState title="No questions yet" subtitle="Be the first to ask the community!" />}
        ListHeaderComponent={
          <Pressable style={styles.askButton} onPress={() => setShowAsk(true)}>
            <Text style={styles.askButtonText}>+ Ask a Question</Text>
          </Pressable>
        }
        onEndReached={() => {
          if (nextCursor) load(nextCursor);
        }}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => (
          <Pressable onPress={() => onSelectQuestion(item)}>
            <Card style={styles.card}>
              <Text style={styles.questionTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <View style={styles.meta}>
                <Text style={styles.metaText}>{item.author.name ?? "User"}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>{item._count?.answers ?? 0} answers</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>{new Date(item.createdAt).toLocaleDateString()}</Text>
              </View>
            </Card>
          </Pressable>
        )}
      />

      {/* Ask a Question Modal */}
      <Modal visible={showAsk} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAsk(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Ask the Community</Text>
            <Pressable onPress={() => setShowAsk(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </Pressable>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Question title…"
            placeholderTextColor={theme.color.textSecondary}
            value={askTitle}
            onChangeText={setAskTitle}
            maxLength={200}
          />
          <TextInput
            style={[styles.input, styles.bodyInput]}
            placeholder="Describe your question…"
            placeholderTextColor={theme.color.textSecondary}
            value={askBody}
            onChangeText={setAskBody}
            multiline
            maxLength={5000}
            textAlignVertical="top"
          />
          <Pressable
            style={[styles.submitBtn, (!askTitle.trim() || !askBody.trim()) && styles.submitDisabled]}
            onPress={handleAsk}
            disabled={isSubmitting || !askTitle.trim() || !askBody.trim()}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Post Question</Text>
            )}
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: theme.color.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.color.background },
  list: { padding: theme.spacing.lg },
  askButton: {
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius,
    paddingVertical: theme.spacing.md,
    alignItems: "center",
    marginBottom: theme.spacing.lg,
  },
  askButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  card: { marginBottom: theme.spacing.md },
  questionTitle: { fontSize: 15, fontWeight: "600", color: theme.color.textPrimary, marginBottom: 6 },
  meta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 },
  metaText: { fontSize: 12, color: theme.color.textSecondary },
  metaDot: { fontSize: 12, color: theme.color.textSecondary },
  modal: { flex: 1, backgroundColor: theme.color.background, padding: theme.spacing.lg },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: theme.spacing.lg },
  modalTitle: { fontSize: 18, fontWeight: "700", color: theme.color.textPrimary },
  modalCancel: { fontSize: 15, color: theme.color.primary },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: 15,
    color: theme.color.textPrimary,
    backgroundColor: theme.color.surface,
    marginBottom: theme.spacing.md,
  },
  bodyInput: { minHeight: 140 },
  submitBtn: {
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius,
    paddingVertical: theme.spacing.md,
    alignItems: "center",
    marginTop: theme.spacing.sm,
  },
  submitDisabled: { opacity: 0.5 },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
