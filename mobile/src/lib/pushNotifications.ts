import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { updateMe } from "./api";

// Configure foreground notification behavior (D-016)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// (A hand-rolled base64/JWT decoder lived here purely to build the fake dev push token from the
// auth token's phone claim. The fake token is gone, and so is the decoder.)

// Schedules an instant local push notification alert (used in dev mode / USB debugging)
export async function scheduleLocalNotification(title: string, body: string, data?: Record<string, unknown>) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: data ?? {},
      },
      trigger: null, // Instant trigger
    });
  } catch (err) {
    console.warn("[push] Local notification error:", err);
  }
}

export async function registerForPushNotificationsAsync(token: string): Promise<void> {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
      // High-priority channel for Emergency blood requests (D-016) — heads-up + sound.
      await Notifications.setNotificationChannelAsync("emergency", {
        name: "Emergency",
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    let expoPushToken: string;
    try {
      if (!Device.isDevice && !__DEV__) return; // simulators/emulators don't have real push tokens

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted" && !__DEV__) return;

      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) {
        // Expo can't mint a token without knowing which EAS project it belongs to. Say so
        // loudly — this is a setup gap, and it used to be papered over with a mock token.
        // eslint-disable-next-line no-console
        console.warn(
          "[push] No EAS projectId (app.json → expo.extra.eas.projectId). Push notifications " +
            "cannot be delivered to this build. Run `eas init`, upload the FCM key with " +
            "`eas credentials`, then rebuild."
        );
        return;
      }
      const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
      expoPushToken = data;
    } catch (e) {
      // Deliberately NOT falling back to a fake `ExponentPushToken[mock-…]` any more.
      //
      // That fallback stored an unusable token on the user's record, so the backend's blood
      // matching counted them as reachable and "sent" pushes that Expo rejected outright
      // (DeviceNotRegistered) — a request that looked fully successful end to end while no
      // device could ever receive it. No token is far more honest than a fake one.
      // eslint-disable-next-line no-console
      console.warn("[push] Could not obtain an Expo push token — this device will not receive pushes:", e);
      return;
    }

    await updateMe(token, { expoPushToken });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[push] Could not register for push notifications:", err);
  }
}
