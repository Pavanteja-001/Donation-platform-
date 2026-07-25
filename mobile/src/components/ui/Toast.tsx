import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { theme } from "../../lib/theme";

type ToastTone = "success" | "danger" | "neutral";

interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// PRD Appendix A.4/A.5 — the one global "toast for success" surface (Chunk 6/7 need this to
// report contribution confirmations, form saves, etc. without a screen-specific banner each
// time). Mounted once at the app root (App.tsx); any screen calls useToast() to use it.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (message: string, tone: ToastTone = "neutral") => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setToast({ id: Date.now(), message, tone });
    },
    []
  );

  useEffect(() => {
    if (!toast) return;
    Animated.timing(opacity, { toValue: 1, duration: theme.motion.fast, useNativeDriver: true }).start();
    timeoutRef.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: theme.motion.fast, useNativeDriver: true }).start(() => setToast(null));
    }, 2500);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [toast, opacity]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Animated.View style={[styles.toast, styles[toast.tone], { opacity }]} pointerEvents="none">
          <Text style={styles.text}>{toast.message}</Text>
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
  toast: {
    position: "absolute",
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    bottom: theme.spacing.xl,
    borderRadius: theme.radius,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    ...theme.elevation.level2,
  },
  success: { backgroundColor: theme.color.success },
  danger: { backgroundColor: theme.color.danger },
  neutral: { backgroundColor: theme.color.textPrimary },
  text: { color: theme.color.onPrimary, fontSize: 14, fontWeight: "600", textAlign: "center" },
});
