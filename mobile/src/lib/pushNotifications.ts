import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { updateMe } from "./api";

// Configure foreground notification behavior (D-016)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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
        name: "General updates",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "notification.wav",
        enableVibrate: true,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#B91C1C",
      });
      await Notifications.setNotificationChannelAsync("emergency", {
        name: "Emergency blood requests",
        importance: Notifications.AndroidImportance.MAX,
        sound: "emergency.wav",
        enableVibrate: true,
        vibrationPattern: [0, 400, 200, 400],
        lightColor: "#DC2626",
      });
    }

    if (!Device.isDevice && !__DEV__) return; // simulators/emulators don't have real push tokens

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted" && !__DEV__) return;

    let fcmToken: string | undefined;
    let expoPushToken: string | undefined;

    // 1. Fetch raw FCM Device Push Token directly from Firebase Cloud Messaging
    try {
      const deviceTokenObj = await Notifications.getDevicePushTokenAsync();
      if (deviceTokenObj?.data) {
        fcmToken = deviceTokenObj.data;
        console.log(`[push] Native FCM Token obtained (${deviceTokenObj.type}):`, fcmToken?.substring(0, 15) + "...");
      }
    } catch (e) {
      console.warn("[push] Could not obtain native FCM token, trying Expo push token fallback:", e);
    }

    // 2. Fetch Expo Push Token as fallback if projectId is set
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (projectId) {
        const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
        expoPushToken = data;
      }
    } catch (e) {
      console.warn("[push] Could not obtain Expo push token:", e);
    }

    if (!fcmToken && !expoPushToken) {
      console.warn("[push] No push token obtained — this device will not receive push notifications.");
      return;
    }

    // Register token(s) with backend
    await updateMe(token, {
      ...(fcmToken ? { fcmToken } : {}),
      ...(expoPushToken ? { expoPushToken } : {}),
    });
  } catch (err) {
    console.warn("[push] Could not register for push notifications:", err);
  }
}
