import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { updateMe } from "./api";

// D-016 — registers this device for Expo push and saves the token server-side (used for the
// eligible blood-donor match, §8.4). Best-effort: no EAS project is configured for this app yet
// (dev-only, no distribution pipeline), so getExpoPushTokenAsync can fail with "no projectId" —
// caught and logged rather than surfaced to the user, same "never let notifications break the
// core flow" principle as the backend's push-sending code.
export async function registerForPushNotificationsAsync(token: string): Promise<void> {
  try {
    if (!Device.isDevice) return; // simulators/emulators don't have real push tokens

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
      // High-priority channel for Emergency blood requests (D-016) — heads-up + sound.
      await Notifications.setNotificationChannelAsync("emergency", {
        name: "Emergency",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return;

    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync();
    await updateMe(token, { expoPushToken });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[push] Could not register for push notifications:", err);
  }
}
