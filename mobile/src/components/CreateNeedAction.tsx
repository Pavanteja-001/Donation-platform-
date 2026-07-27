import { useCallback } from "react";
import { Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { isProfileComplete } from "../lib/profile";
import type { AppNavigationProp } from "../navigation/types";

/**
 * Opens the create-need flow, gated on a complete profile.
 *
 * Lives here rather than inside TabNavigator because the feed hero now offers the same action —
 * and duplicating the gate would mean one entry point could drift out of sync and let an
 * incomplete profile through.
 */
export function useCreateNeedFlow() {
  const { user } = useAuth();
  const navigation = useNavigation<AppNavigationProp>();

  return useCallback(() => {
    if (!isProfileComplete(user)) {
      Alert.alert(
        "Complete your profile",
        "Posting a need requires a completed profile (full name, date of birth, gender, blood group, city and area).",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Complete profile", onPress: () => navigation.navigate("Register", { isSkippable: true }) },
        ]
      );
      return;
    }
    navigation.navigate("CreateNeedChooser");
  }, [user, navigation]);
}

export function useForumFlow() {
  const navigation = useNavigation<AppNavigationProp>();
  return useCallback(() => navigation.navigate("Forum"), [navigation]);
}
