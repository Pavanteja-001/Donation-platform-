// PRD §12 — Forum question detail: the full question, its answers, and a reply form.
import { useState, useCallback, useEffect } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert, TextInput, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
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
import { Avatar, Badge, EmptyState, ErrorState, Skeleton, PressableScale } from "../components/ui";
import { TierChip } from "../components/TierChip";
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

/**
 * Long answers collapse rather than pushing every later reply off the screen.
 *
 * The threshold is on character count, not measured line count: measuring means rendering the
 * text twice and reading back layout, and the only thing that buys is precision about *exactly*
 * where the fold falls — which nobody can perceive. A stable, predictable cut is worth more here.
 */
const COLLAPSE_OVER_CHARS = 240;
const COLLAPSED_LINES = 4;
/** Replies shown before "View all" — enough to see the discussion has substance. */
const INITIAL_ANSWERS = 3;

/**
 * One answer, laid out as a comment rather than a card.
 *
 * Cards made every reply look like a separate document, so five answers read as five unrelated
 * posts. Stacking them flat — avatar in a gutter, everything else in a column beside it — is the
 * pattern every threaded discussion uses, and it makes the thread legible as a conversation.
 */
function AnswerRow({
  answer,
  canDelete,
  onDelete,
}: {
  answer: ForumAnswer;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = answer.body.length > COLLAPSE_OVER_CHARS;
  const answered = timeAgo(answer.createdAt);

  return (
    <View style={styles.commentRow}>
      <Avatar name={answer.author.name} photoUrl={answer.author.profilePhotoUrl} size={34} />

      <View style={styles.commentBody}>
        <View style={styles.commentMeta}>
          <Text style={styles.commentName} numberOfLines={1}>
            {answer.author.name ?? "User"}
          </Text>
          <TierChip tier={answer.author.trustTier} />
          {answered ? <Text style={styles.commentTime}>· {answered}</Text> : null}
        </View>

        <Text style={styles.commentText} numberOfLines={isLong && !isExpanded ? COLLAPSED_LINES : undefined}>
          {answer.body}
        </Text>

        {isLong && (
          <PressableScale onPress={() => setIsExpanded((v) => !v)} scaleTo={0.97} hitSlop={6}>
            <Text style={styles.moreLink}>{isExpanded ? "Show less" : "Read more"}</Text>
          </PressableScale>
        )}
      </View>

      {canDelete && (
        <PressableScale onPress={onDelete} hitSlop={10} accessibilityLabel="Delete answer" style={styles.commentDelete}>
          <Feather name="trash-2" size={14} color={theme.color.textTertiary} />
        </PressableScale>
      )}
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
  const [showAllAnswers, setShowAllAnswers] = useState(false);
  // This screen sits under a native stack header, which `KeyboardAvoidingView` doesn't know about;
  // without offsetting it the padding overshoots by the header's height and leaves a dead gap.
  const headerOffset = useHeaderHeight();

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
  // `answers` is undefined — not empty — until the detail fetch lands. Opening a question from
  // the list hands over the list payload, which carries `_count.answers` but no answers array, so
  // treating undefined as [] rendered "No answers yet" for a beat on every thread that has some.
  const answers = question.answers;
  const isAnswersLoading = answers === undefined;
  // The count is known from the list before the bodies arrive, so the heading never says 0 first.
  const answerCount = answers?.length ?? question._count?.answers ?? 0;
  const asked = timeAgo(question.createdAt);
  // A long thread opens on the first few replies, like every comment section does — the composer
  // has to stay reachable without scrolling past forty answers to find it.
  const visibleAnswers = !answers ? [] : showAllAnswers ? answers : answers.slice(0, INITIAL_ANSWERS);
  const hiddenCount = (answers?.length ?? 0) - visibleAnswers.length;

  return (
    // `padding` on both platforms, not just iOS. Android used to rely on the window resizing under
    // `adjustResize`, but the app runs edge-to-edge, where the window no longer shrinks when the
    // keyboard opens — so with no behavior set the composer stayed put and the keyboard covered it.
    <KeyboardAvoidingView style={styles.container} behavior="padding" keyboardVerticalOffset={headerOffset}>
      <FlashList
        data={visibleAnswers}
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
                {answerCount} {answerCount === 1 ? "answer" : "answers"}
              </Text>
              {!isAnswersLoading && answerCount === 0 && <Badge label="Unanswered" tone="accent" />}
            </View>
          </View>
        }
        ListEmptyComponent={
          isAnswersLoading ? (
            // Shaped like the comment rows it will become, and sized from the count the list
            // already gave us — so nothing shifts when the bodies arrive.
            <View>
              {Array.from({ length: Math.min(Math.max(answerCount, 1), 3) }, (_, i) => (
                <View key={i} style={styles.commentRow}>
                  <Skeleton width={34} height={34} radius={17} />
                  <View style={styles.commentBody}>
                    <Skeleton width={110} height={12} />
                    <Skeleton width="100%" height={13} />
                    <Skeleton width="72%" height={13} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <EmptyState
              icon="message-square"
              title="No answers yet"
              subtitle="If you know something about this, you'd be the first to help."
            />
          )
        }
        renderItem={({ item }: { item: ForumAnswer }) => (
          <AnswerRow
            answer={item}
            canDelete={isModerator || item.author.id === user?.id}
            onDelete={() => handleDeleteAnswer(item.id)}
          />
        )}
        ListFooterComponent={
          hiddenCount > 0 ? (
            <PressableScale onPress={() => setShowAllAnswers(true)} scaleTo={0.98} style={styles.showAll}>
              <Feather name="chevron-down" size={15} color={theme.color.primary} />
              <Text style={styles.showAllText}>
                View {hiddenCount} more {hiddenCount === 1 ? "answer" : "answers"}
              </Text>
            </PressableScale>
          ) : null
        }
      />

      {/* A comment bar, not a form. The old version was a bordered multiline field with a
          full-width "Post answer" button underneath — it read as filing paperwork, and it took a
          third of the screen while you typed. This is the shape everyone already knows: your own
          avatar, a pill you type into, and a send button that only lights up once you've written
          something. */}
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, theme.spacing.md) }]}>
        <Avatar name={user?.name} photoUrl={user?.profilePhotoUrl} size={30} />
        <TextInput
          style={styles.composerInput}
          placeholder="Add an answer…"
          placeholderTextColor={theme.color.textTertiary}
          value={answerBody}
          onChangeText={setAnswerBody}
          multiline
          maxLength={5000}
        />
        <PressableScale
          onPress={handleAnswer}
          disabled={!answerBody.trim() || isSubmitting}
          scaleTo={0.9}
          accessibilityLabel="Post answer"
          style={[styles.sendButton, !answerBody.trim() && styles.sendButtonIdle]}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={theme.color.onPrimary} />
          ) : (
            <Feather name="arrow-up" size={18} color={answerBody.trim() ? theme.color.onPrimary : theme.color.textTertiary} />
          )}
        </PressableScale>
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

  // --- Comment thread ---------------------------------------------------------------------
  commentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
  },
  commentBody: { flex: 1, gap: 3 },
  commentMeta: { flexDirection: "row", alignItems: "center", gap: 5 },
  commentName: {
    ...theme.typography.caption,
    fontWeight: "800",
    color: theme.color.textPrimary,
    flexShrink: 1,
  },
  commentTime: { ...theme.typography.caption, color: theme.color.textTertiary, fontSize: 11 },
  commentText: { ...theme.typography.bodySmall, color: theme.color.textPrimary, lineHeight: 20 },
  moreLink: {
    ...theme.typography.caption,
    fontWeight: "800",
    color: theme.color.textSecondary,
    marginTop: 2,
  },
  // Quiet on purpose — destructive, and it sits next to every single reply.
  commentDelete: { padding: 4, marginTop: 2 },

  showAll: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: theme.spacing.md,
  },
  showAllText: { ...theme.typography.caption, fontWeight: "800", color: theme.color.primary },

  // --- Composer ---------------------------------------------------------------------------
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    backgroundColor: theme.color.surface,
    borderTopWidth: 1,
    borderTopColor: theme.color.borderSubtle,
  },
  composerInput: {
    flex: 1,
    ...theme.typography.bodySmall,
    color: theme.color.textPrimary,
    backgroundColor: theme.color.surfaceMuted,
    borderRadius: theme.radii.xl,
    paddingHorizontal: theme.spacing.md,
    // Vertical padding rather than a fixed height, so the pill grows with the text.
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    maxHeight: 120,
  },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.color.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonIdle: { backgroundColor: theme.color.surfaceMuted },
});
