import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "./theme";

/**
 * Bottom padding for a scrolling screen whose last element is actionable.
 *
 * Tab screens don't need this — React Navigation insets them by the tab bar's measured height,
 * and that bar already adds the safe-area inset itself. **Pushed** screens (need detail, the
 * create forms, register, book-a-slot…) have no tab bar underneath, so nothing stops their final
 * button ending up beneath Android's gesture bar or the iPhone home indicator.
 *
 * A fixed `paddingBottom` can't solve it: the inset is 0 on a phone with hardware buttons and
 * ~24–48px on a gesture-nav device, so any constant is either wasteful or too small.
 */
export function useBottomInset(base: number = theme.spacing.xxxl): number {
  const insets = useSafeAreaInsets();
  return base + insets.bottom;
}
