import { Alert, StyleSheet, Pressable } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { NeedsFeedScreen } from "../screens/NeedsFeedScreen";
import { MyNeedsScreen } from "../screens/MyNeedsScreen";
import { MyContributionsScreen } from "../screens/MyContributionsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { theme } from "../lib/theme";
import { useAuth } from "../context/AuthContext";
import { isProfileComplete } from "../lib/profile";
import type { AppNavigationProp, TabParamList } from "./types";

const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ICON: Record<keyof TabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: "home",
  MyNeeds: "list",
  Activity: "time",
  Profile: "person",
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function CreateNeedButton() {
  const { user } = useAuth();
  const navigation = useNavigation<AppNavigationProp>();
  const scale = useSharedValue(1);

  const handlePress = () => {
    if (!isProfileComplete(user)) {
      Alert.alert(
        "Complete Profile",
        "Posting a need requires a completed profile details (Full name, DOB, gender, blood group, city and area).",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Complete Profile", onPress: () => navigation.navigate("Register", { isSkippable: true }) },
        ]
      );
    } else {
      navigation.navigate("CreateNeedChooser");
    }
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={() => (scale.value = withSpring(0.9, { damping: 15 }))}
      onPressOut={() => (scale.value = withSpring(1, { damping: 15 }))}
      style={[styles.headerButton, animatedStyle]}
    >
      <Ionicons name="add-circle" size={28} color={theme.color.primary} />
    </AnimatedPressable>
  );
}

function HomeTabScreen() {
  const navigation = useNavigation<AppNavigationProp>();
  return <NeedsFeedScreen onSelectNeed={(need) => navigation.navigate("NeedDetail", { needId: need.id, initialNeed: need })} />;
}

function MyNeedsTabScreen() {
  const navigation = useNavigation<AppNavigationProp>();
  return <MyNeedsScreen onSelectNeed={(need) => navigation.navigate("NeedDetail", { needId: need.id, initialNeed: need })} />;
}

function ActivityTabScreen() {
  const navigation = useNavigation<AppNavigationProp>();
  return (
    <MyContributionsScreen
      onViewCertificate={(contributionId) => navigation.navigate("Certificate", { contributionId })}
    />
  );
}

// Chunk 2 (Milestone 9) — the four bottom tabs (PRD Appendix A.4: "Home · Search · Activity ·
// Profile" — this app has no separate Search yet, so My Needs takes that slot for now). Replaces
// HomeScreen's local view-switching entirely.
export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: theme.color.primary,
        tabBarInactiveTintColor: theme.color.textSecondary,
        tabBarIcon: ({ color, size }) => <Ionicons name={TAB_ICON[route.name]} size={size} color={color} />,
        headerTitleStyle: theme.typography.h2,
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeTabScreen}
        options={{ title: "Live needs", headerRight: () => <CreateNeedButton /> }}
      />
      <Tab.Screen
        name="MyNeeds"
        component={MyNeedsTabScreen}
        options={{ title: "My needs", headerRight: () => <CreateNeedButton /> }}
      />
      <Tab.Screen name="Activity" component={ActivityTabScreen} options={{ title: "My contributions" }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  headerButton: { marginRight: theme.spacing.md },
});
