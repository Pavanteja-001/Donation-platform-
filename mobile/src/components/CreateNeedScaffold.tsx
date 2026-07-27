import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import type { NeedType } from "../lib/api";
import { TYPE_META } from "../lib/needMeta";
import { theme } from "../lib/theme";
import { Button } from "./ui";

/**
 * The shared shell for all seven "post a need" forms.
 *
 * Every form had the same 40 lines of scaffolding — scroll container, heading, verification
 * hint, error text, submit button — copied seven times and already drifting (one used
 * `loading`, another faked it with a disabled button and a changing label). This owns that
 * structure so each screen is only its own fields, and a change to the posting experience is
 * one edit rather than seven.
 */
export function CreateNeedScaffold({
  type,
  title,
  subtitle,
  children,
  error,
  onSubmit,
  isSubmitting,
  submitLabel = "Submit for verification",
}: {
  type: NeedType;
  title: string;
  subtitle: string;
  children: ReactNode;
  error?: string | null;
  onSubmit: () => void;
  isSubmitting: boolean;
  submitLabel?: string;
}) {
  const meta = TYPE_META[type];
  // Blood posts get crimson CTAs; every other type stays on the platform teal.
  const isBlood = type === "BLOOD";

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(360)} style={styles.header}>
          <View style={[styles.typeIcon, { backgroundColor: meta.tint }]}>
            <Feather name={meta.icon} size={20} color={meta.color} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(60).duration(360)} style={[styles.card, theme.elevation.level2]}>
          {children}
        </Animated.View>

        {/* PRD §6.3 — every need is admin-verified before it can go LIVE. Saying so up front sets
            the expectation that posting is not the same as being published. */}
        <Animated.View entering={FadeInDown.delay(120).duration(360)} style={styles.noticeBox}>
          <Feather name="shield" size={15} color={theme.color.info} />
          <Text style={styles.noticeText}>
            An admin reviews every request before it goes live. You'll see the status update in
            <Text style={styles.noticeStrong}> My needs</Text>.
          </Text>
        </Animated.View>

        {error && (
          <Animated.View entering={FadeIn.duration(theme.motion.fast)} style={styles.errorBox}>
            <Feather name="alert-circle" size={15} color={theme.color.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </Animated.View>
        )}

        <View style={styles.actions}>
          <Button
            label={submitLabel}
            icon="send"
            size="lg"
            glow
            variant={isBlood ? "blood" : "primary"}
            onPress={onSubmit}
            loading={isSubmitting}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Label + control grouping for non-Input fields (chip grids, pickers, mode switches). */
export function Field({
  label,
  helper,
  error,
  children,
}: {
  label: string;
  helper?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      {helper ? <Text style={styles.fieldHelper}>{helper}</Text> : null}
      <View style={styles.fieldBody}>{children}</View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.background },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxxl, gap: theme.spacing.md },

  header: { alignItems: "flex-start", gap: theme.spacing.sm, paddingHorizontal: theme.spacing.xs, paddingTop: theme.spacing.sm },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.xs,
  },
  title: { ...theme.typography.h1, color: theme.color.textPrimary },
  subtitle: { ...theme.typography.bodySmall, color: theme.color.textSecondary },

  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.xl,
    gap: theme.spacing.lg,
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
  noticeStrong: { fontWeight: "800", color: theme.color.textPrimary },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.color.dangerSoft,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
  },
  errorText: { ...theme.typography.bodySmall, color: theme.color.dangerDeep, fontWeight: "600", flex: 1 },

  actions: { marginTop: theme.spacing.xs },

  fieldLabel: { ...theme.typography.caption, fontWeight: "700", color: theme.color.textPrimary },
  fieldHelper: { ...theme.typography.caption, color: theme.color.textTertiary, marginTop: 2 },
  fieldBody: { marginTop: theme.spacing.sm },
  fieldError: { ...theme.typography.caption, color: theme.color.danger, fontWeight: "600", marginTop: theme.spacing.sm },
});
