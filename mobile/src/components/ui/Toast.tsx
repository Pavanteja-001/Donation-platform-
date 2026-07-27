import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  cancelAnimation,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { theme } from "../../lib/theme";

type ToastTone = "success" | "danger" | "neutral" | "info";

interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const TONE: Record<ToastTone, { icon: keyof typeof Feather.glyphMap; color: string }> = {
  success: { icon: "check-circle", color: "#34D399" },
  danger: { icon: "alert-circle", color: "#F87171" },
  info: { icon: "info", color: "#60A5FA" },
  neutral: { icon: "bell", color: theme.color.textTertiary },
};

const VISIBLE_MS = 2800;

// PRD Appendix A.4/A.5 — the one global toast surface. Mounted once at the app root (App.tsx);
// any screen calls useToast().
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, tone: ToastTone = "neutral") => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setToast({ id: Date.now(), message, tone });
  }, []);

  const clear = useCallback(() => setToast(null), []);

  const dismiss = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    progress.value = withTiming(0, { duration: theme.motion.fast }, (finished) => {
      if (finished) runOnJS(clear)();
    });
  }, [clear, progress]);

  useEffect(() => {
    if (!toast) return;

    progress.value = withSpring(1, theme.motion.spring.gentle);
    timeoutRef.current = setTimeout(dismiss, VISIBLE_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      cancelAnimation(progress);
    };
    // Keyed on id so re-showing the same message re-triggers the entrance.
  }, [toast?.id, dismiss, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 32 }, { scale: 0.96 + progress.value * 0.04 }],
  }));

  const palette = toast ? TONE[toast.tone] : null;

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && palette && (
        <Animated.View
          style={[styles.wrap, { bottom: insets.bottom + theme.spacing.xl }, animatedStyle]}
          pointerEvents="box-none"
        >
          {/* Tappable so a toast never blocks the thing underneath it for its full duration. */}
          <Pressable onPress={dismiss} style={styles.toast} accessibilityRole="alert">
            <View style={[styles.iconWrap, { backgroundColor: palette.color + "26" }]}>
              <Feather name={palette.icon} size={15} color={palette.color} />
            </View>
            <Text style={styles.text} numberOfLines={3}>
              {toast.message}
            </Text>
          </Pressable>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: theme.spacing.lg,
    right: theme.spacing.lg,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: theme.color.textPrimary,
    borderRadius: theme.radii.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    ...theme.elevation.level3,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: theme.radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { color: "#FFFFFF", fontSize: 14, fontWeight: "600", flex: 1, lineHeight: 20 },
});
