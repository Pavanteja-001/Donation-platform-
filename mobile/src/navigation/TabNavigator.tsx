import { StyleSheet, TouchableOpacity } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { NeedsFeedScreen } from "../screens/NeedsFeedScreen";
import { MyNeedsScreen } from "../screens/MyNeedsScreen";
import { MyContributionsScreen } from "../screens/MyContributionsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { theme } from "../lib/theme";
import type { AppNavigationProp, TabParamList } from "./types";

const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ICON: Record<keyof TabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: "home",
  MyNeeds: "list",
  Activity: "time",
  Profile: "person",
};

// A small header button, not a screen prop — calling useNavigation() here resolves against
// whichever navigator actually rendered it, but `navigate()` still finds "CreateNeedChooser" by
// searching up to the parent root stack, same as every other cross-navigator navigate() call in
// this file (React Navigation's normal route-resolution behavior, not a hack specific to this).
function CreateNeedButton() {
  const navigation = useNavigation<AppNavigationProp>();
  return (
    <TouchableOpacity onPress={() => navigation.navigate("CreateNeedChooser")} style={styles.headerButton}>
      <Ionicons name="add-circle" size={26} color={theme.color.primary} />
    </TouchableOpacity>
  );
}

function HomeTabScreen() {
  const navigation = useNavigation<AppNavigationProp>();
  return <NeedsFeedScreen onSelectNeed={(need) => navigation.navigate("NeedDetail", { needId: need.id })} />;
}

function MyNeedsTabScreen() {
  const navigation = useNavigation<AppNavigationProp>();
  return <MyNeedsScreen onSelectNeed={(need) => navigation.navigate("NeedDetail", { needId: need.id })} />;
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
