// PRD §12 — Community Q&A forum. Lists questions with answer counts; users can ask new ones.
// Cursor pagination.
import { useState, useCallback } from "react";
import { View, Text, StyleSheet, Modal, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { FlashList } from "@shopify/flash-list";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { fetchForumQuestions, askForumQuestion, type ForumQuestion } from "../lib/api";
import { theme } from "../lib/theme";
import { useBottomInset } from "../lib/safeArea";
import { timeAgo } from "../lib/needMeta";
import { Avatar, Button, EmptyState, ErrorState, Input, Skeleton, PressableScale } from "../components/ui";
import { Gradient } from "../components/Gradient";

type Props = { onSelectQuestion: (question: ForumQuestion) => void };

function ForumSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[styles.card, theme.elevation.level1, { gap: theme.spacing.md }]}>
          <Skeleton width="85%" height={18} />
          <Skeleton width="60%" height={13} />
          <View style={styles.rowBetween}>
            <Skeleton width={110} height={20} radius={theme.radii.pill} />
            <Skeleton width={70} height={20} radius={theme.radii.pill} />
          </View>
        </View>
      ))}
    </View>
  );
}

function QuestionCard({ item, onPress }: { item: ForumQuestion; onPress: () => void }) {
  const answers = item._count?.answers ?? 0;
  const asked = timeAgo(item.createdAt);

  return (
    <PressableScale onPress={onPress} scaleTo={0.985} style={[styles.card, theme.elevation.level2]}>
      {/* Same lit surface as the needs feed, so the community layer doesn't read as a different
          app bolted on beside it. */}
      <Gradient
        colors={theme.gradient.surfaceSheen}
        direction="diagonal"
        style={StyleSheet.absoluteFill as never}
        pointerEvents="none"
      />
      <Text style={styles.questionTitle} numberOfLines={2}>
        {item.title}
      </Text>

      <View style={styles.metaRow}>
        <View style={styles.authorGroup}>
          <Avatar name={item.author.name} size={22} />
          <Text style={styles.authorName} numberOfLines={1}>
            {item.author.name ?? "User"}
          </Text>
        </View>

        <View style={styles.metaRight}>
          {asked && <Text style={styles.metaText}>{asked}</Text>}
          {/* An answered question reads differently from an open one, so the count is a chip
              rather than another grey line of text. */}
          <View style={[styles.answerChip, answers > 0 && styles.answerChipActive]}>
            <Feather
              name="message-circle"
              size={11}
              color={answers > 0 ? theme.color.primary : theme.color.textTertiary}
            />
            <Text style={[styles.answerChipText, answers > 0 && styles.answerChipTextActive]}>
              {answers}
            </Text>
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

export function ForumScreen({ onSelectQuestion }: Props) {
  const { token } = useAuth();
  const [questions, setQuestions] = useState<ForumQuestion[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Absolutely positioned, so nothing else pushes it clear of Android's gesture bar.
  const fabBottom = useBottomInset(theme.spacing.lg);
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
        setHasLoaded(true);
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

  function closeAsk() {
    setShowAsk(false);
    setAskTitle("");
    setAskBody("");
  }

  if (isLoading && questions.length === 0) {
    return (
      <View style={styles.container}>
        <ForumSkeleton />
      </View>
    );
  }

  if (error && questions.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ErrorState message={error} onRetry={() => load()} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {questions.length === 0 && hasLoaded ? (
        <View style={styles.centered}>
          <EmptyState
            icon="message-circle"
            title="No questions yet"
            subtitle="Be the first to ask the community — someone here has probably been through it."
            actionLabel="Ask a question"
            onAction={() => setShowAsk(true)}
          />
        </View>
      ) : (
        <FlashList
          data={questions}
          keyExtractor={(q) => q.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <QuestionCard item={item} onPress={() => onSelectQuestion(item)} />}
          onEndReached={() => {
            if (nextCursor) load(nextCursor);
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            nextCursor ? (
              <View style={styles.loadingMore}>
                <Skeleton width="100%" height={72} radius={theme.radii.xl} />
              </View>
            ) : null
          }
        />
      )}

      {/* Floating compose button — the primary action stays reachable no matter how far down the
          list you've scrolled, which a list-header button doesn't. */}
      {questions.length > 0 && (
        <Animated.View entering={FadeInDown.duration(360)} style={[styles.fabWrap, { bottom: fabBottom }]}>
          <PressableScale onPress={() => setShowAsk(true)} accessibilityLabel="Ask a question" style={styles.fab}>
            <Gradient
              colors={["#D33B3B", "#B91C1C", "#8E1414"]}
              direction="diagonal"
              style={StyleSheet.absoluteFill as never}
              pointerEvents="none"
            />
            <Gradient
              colors={["rgba(255,255,255,0.28)", "rgba(255,255,255,0)"]}
              angle={{ start: { x: 0.2, y: 0 }, end: { x: 0.55, y: 0.9 } }}
              style={StyleSheet.absoluteFill as never}
              pointerEvents="none"
            />
            <Feather name="edit-3" size={18} color={theme.color.onPrimary} />
            <Text style={styles.fabText}>Ask</Text>
          </PressableScale>
        </Animated.View>
      )}

      <Modal visible={showAsk} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeAsk}>
        <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Ask the community</Text>
            <PressableScale onPress={closeAsk} hitSlop={10} style={styles.modalClose}>
              <Feather name="x" size={20} color={theme.color.textSecondary} />
            </PressableScale>
          </View>

          <View style={styles.modalBody}>
            <Input
              label="Question"
              placeholder="What do you want to ask?"
              icon="help-circle"
              value={askTitle}
              onChangeText={setAskTitle}
              maxLength={200}
              helper={`${askTitle.length}/200`}
            />

            <Input
              label="Details"
              placeholder="Add context so people can actually help…"
              multiline
              value={askBody}
              onChangeText={setAskBody}
              maxLength={5000}
            />

            {/* PRD §12.3 — the forum is moderated; saying so up front is cheaper than removing
                posts later. */}
            <View style={styles.noticeBox}>
              <Feather name="info" size={15} color={theme.color.info} />
              <Text style={styles.noticeText}>
                Questions are public and moderated. Don't share personal medical or contact details.
              </Text>
            </View>
          </View>

          <Animated.View entering={FadeIn.duration(theme.motion.fast)} style={styles.modalActions}>
            <Button
              label="Post question"
              icon="send"
              size="lg"
              glow
              onPress={handleAsk}
              disabled={!askTitle.trim() || !askBody.trim()}
              loading={isSubmitting}
            />
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing.xl },
  list: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxxl * 2 },
  skeletonWrap: { padding: theme.spacing.lg, gap: theme.spacing.md },
  loadingMore: { paddingTop: theme.spacing.xs },

  card: {
    backgroundColor: theme.color.surface,
    // Clips the lit sheen overlay to the card radius.
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.md,
  },
  questionTitle: { ...theme.typography.h3, color: theme.color.textPrimary },

  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  authorGroup: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flexShrink: 1 },
  authorName: { ...theme.typography.caption, color: theme.color.textSecondary, fontWeight: "600", flexShrink: 1 },
  metaRight: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  metaText: { ...theme.typography.caption, color: theme.color.textTertiary },

  answerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.color.surfaceMuted,
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
  },
  answerChipActive: { backgroundColor: theme.color.primarySoft },
  answerChipText: { ...theme.typography.caption, fontWeight: "800", color: theme.color.textTertiary },
  answerChipTextActive: { color: theme.color.primary },

  fabWrap: { position: "absolute", right: theme.spacing.lg },
  fab: {
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.color.primary,
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    ...theme.glow.primary,
  },
  fabText: { color: theme.color.onPrimary, fontWeight: "800", fontSize: 15 },

  modal: { flex: 1, backgroundColor: theme.color.background },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.borderSubtle,
  },
  modalTitle: { ...theme.typography.h2, color: theme.color.textPrimary },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.color.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: { flex: 1, padding: theme.spacing.lg, gap: theme.spacing.lg },
  modalActions: {
    padding: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.color.borderSubtle,
  },

  noticeBox: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    alignItems: "flex-start",
    backgroundColor: theme.color.infoSoft,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
  },
  noticeText: { ...theme.typography.caption, color: theme.color.textSecondary, flex: 1, lineHeight: 17 },
});
