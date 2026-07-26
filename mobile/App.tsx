import { useEffect } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { createNavigationContainerRef, NavigationContainer } from "@react-navigation/native";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { LoginScreen } from "./src/screens/LoginScreen";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { theme } from "./src/lib/theme";
import { ToastProvider } from "./src/components/ui";
import { registerForPushNotificationsAsync } from "./src/lib/pushNotifications";
import * as Notifications from "expo-notifications";

export const navigationRef = createNavigationContainerRef<any>();

function Root() {
  const { user, token, isLoading } = useAuth();

  // D-016 — register this device for push once per login session (best-effort; see
  // lib/pushNotifications.ts for why it can silently no-op in this dev setup). Previously lived
  // in HomeScreen (now replaced by RootNavigator, Chunk 2) — moved here since this is the
  // equivalent "user is logged in" gate now.
  useEffect(() => {
    if (token) registerForPushNotificationsAsync(token);
  }, [token]);

  // Handle notification taps to navigate directly to the matched need details (D-016)
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const needId = response.notification.request.content.data?.needId;
      if (needId) {
        const navigateWhenReady = () => {
          if (navigationRef.isReady()) {
            navigationRef.navigate("NeedDetail", { needId });
          } else {
            setTimeout(navigateWhenReady, 50);
          }
        };
        navigateWhenReady();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color={theme.color.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.flex}>
        <LoginScreen />
      </SafeAreaView>
    );
  }

  // Chunk 2 (Milestone 9) — NativeStack's headers already handle top safe-area insets
  // themselves, so the navigator is deliberately not wrapped in another SafeAreaView (that would
  // double up the inset padding); SafeAreaProvider at the app root is what react-native-screens
  // actually needs to be present.
  return (
    <NavigationContainer ref={navigationRef}>
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ToastProvider>
          <Root />
          <StatusBar style="auto" />
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.color.background },
});
