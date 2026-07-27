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

const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function customAtob(input: string): string {
  const str = input.replace(/=+$/, "");
  let output = "";
  if (str.length % 4 === 1) {
    throw new Error("Base64 decode failed");
  }
  for (
    let bc = 0, bs = 0, rbuffer, idx = 0;
    (rbuffer = str.charAt(idx++));
    ~rbuffer && ((bs = bc % 4 ? bs * 64 + rbuffer : rbuffer), bc++ % 4)
      ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
      : 0
  ) {
    rbuffer = chars.indexOf(rbuffer);
  }
  return output;
}

function decodeJwt(token: string) {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = customAtob(base64);
    const unicodeChars = bytes.split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2));
    const jsonPayload = decodeURIComponent(unicodeChars.join(""));
    return JSON.parse(jsonPayload);
  } catch (err) {
    return null;
  }
}

// D-016 — registers this device for Expo push and saves the token server-side (used for the
// eligible blood-donor match, §8.4). Best-effort: no EAS project is configured for this app yet
// (dev-only, no distribution pipeline), so getExpoPushTokenAsync can fail with "no projectId" —
// caught and logged rather than surfaced to the user, same "never let notifications break the
// core flow" principle as the backend's push-sending code.
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
      const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : {});
      expoPushToken = data;
    } catch (e) {
      if (__DEV__) {
        const decoded = decodeJwt(token);
        const suffix = decoded?.phone ? decoded.phone.replace(/\D/g, "") : Math.random().toString(36).substring(7);
        expoPushToken = `ExponentPushToken[mock-${suffix}]`;
        // eslint-disable-next-line no-console
        console.log("[push] Dev fallback mock token registered:", expoPushToken);
      } else {
        throw e;
      }
    }

    await updateMe(token, { expoPushToken });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[push] Could not register for push notifications:", err);
  }
}
