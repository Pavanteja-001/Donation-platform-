import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, withSpring, useDerivedValue, interpolateColor } from "react-native-reanimated";
import { createBottomTabNavigator, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LitEdge } from "../components/Depth";
import { NeedsFeedScreen } from "../screens/NeedsFeedScreen";
import { NeedsMapScreen } from "../screens/NeedsMapScreen";
import { MyNeedsScreen } from "../screens/MyNeedsScreen";
import { MyContributionsScreen } from "../screens/MyContributionsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { theme } from "../lib/theme";
import { useCreateNeedFlow } from "../components/CreateNeedAction";
import { PressableScale } from "../components/ui";
import type { AppNavigationProp, TabParamList } from "./types";

const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ICON: Record<keyof TabParamList, keyof typeof Feather.glyphMap> = {
  Home: "home",
  Map: "map-pin",
  MyNeeds: "file-text",
  Activity: "clock",
  Profile: "user",
};

function HeaderIconButton({
  icon,
  onPress,
  accessibilityLabel,
  side,
}: {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  side: "left" | "right";
}) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.9}
      hitSlop={8}
      accessibilityLabel={accessibilityLabel}
      style={[styles.headerButton, side === "left" ? styles.headerButtonLeft : styles.headerButtonRight]}
    >
      <Feather name={icon} size={19} color={theme.color.primary} />
    </PressableScale>
  );
}

function CreateNeedButton() {
  // Shares the profile gate with the feed hero's own create button (see CreateNeedAction).
  const openCreate = useCreateNeedFlow();
  return <HeaderIconButton icon="plus" onPress={openCreate} accessibilityLabel="Create a need" side="right" />;
}

/**
 * One tab. The active state animates a tinted pill in behind the icon and reveals the label,
 * so the current tab is legible at a glance without every tab shouting its name.
 */
function TabItem({
  isFocused,
  icon,
  label,
  onPress,
}: {
  isFocused: boolean;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const progress = useDerivedValue(
    () => withSpring(isFocused ? 1 : 0, theme.motion.spring.gentle),
    [isFocused]
  );

  const pillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ["rgba(15,118,110,0)", theme.color.primarySoft]),
    paddingHorizontal: 12 + progress.value * 6,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    width: progress.value === 0 ? 0 : undefined,
    marginLeft: progress.value * 6,
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + progress.value * 0.06 }],
  }));

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.92}
      accessibilityRole="tab"
      accessibilityLabel={label}
      style={styles.tabItemWrap}
    >
      <Animated.View style={[styles.tabPill, pillStyle]}>
        <Animated.View style={iconStyle}>
          <Feather name={icon} size={20} color={isFocused ? theme.color.primary : theme.color.textTertiary} />
        </Animated.View>
        <Animated.View style={labelStyle}>
          <Text style={styles.tabLabel} numberOfLines={1}>
            {label}
          </Text>
        </Animated.View>
      </Animated.View>
    </PressableScale>
  );
}

/**
 * Custom floating tab bar. The stock bar is a flat strip flush to the screen edge; this one
 * floats on the canvas with the same card geometry as the rest of the app, so the navigation
 * reads as part of the design system rather than a platform default bolted underneath it.
 */
function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBarWrap, { paddingBottom: Math.max(insets.bottom, theme.spacing.md) }]}>
      <View style={[styles.tabBar, theme.elevation.level4]}>
        {/* Real frosted glass: content scrolling underneath is visible and blurred, which is what
            makes the bar read as floating *above* the page rather than pasted onto it. The tint
            below keeps contrast on Android, where the blur is cheaper and lighter. */}
        <BlurView intensity={38} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.tabBarTint} pointerEvents="none" />
        <LitEdge style={styles.tabBarEdge} />
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const label = options.title ?? route.name;

          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <TabItem
              key={route.key}
              isFocused={isFocused}
              icon={TAB_ICON[route.name as keyof TabParamList]}
              label={label}
              onPress={onPress}
            />
          );
        })}
      </View>
    </View>
  );
}

function HomeTabScreen() {
  const navigation = useNavigation<AppNavigationProp>();
  return <NeedsFeedScreen onSelectNeed={(need) => navigation.navigate("NeedDetail", { needId: need.id, initialNeed: need })} />;
}

function MapTabScreen() {
  const navigation = useNavigation<AppNavigationProp>();
  return <NeedsMapScreen onSelectNeed={(need) => navigation.navigate("NeedDetail", { needId: need.id, initialNeed: need })} />;
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

export function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerStyle: styles.header,
        headerShadowVisible: false,
        headerTitleStyle: styles.headerTitle,
        headerTitleAlign: "center",
        sceneStyle: styles.scene,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeTabScreen}
        options={{ title: "Home", headerShown: false }}
      />
      <Tab.Screen
        name="Map"
        component={MapTabScreen}
        options={{ title: "Map View", headerShown: false }}
      />
      <Tab.Screen
        name="MyNeeds"
        component={MyNeedsTabScreen}
        options={{ title: "My needs", headerRight: () => <CreateNeedButton /> }}
      />
      <Tab.Screen name="Activity" component={ActivityTabScreen} options={{ title: "Activity", headerTitle: "My contributions" }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: theme.color.background },
  headerTitle: { ...theme.typography.h2, color: theme.color.textPrimary },
  scene: { backgroundColor: theme.color.background },

  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.color.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  headerButtonLeft: { marginLeft: theme.spacing.lg },
  headerButtonRight: { marginRight: theme.spacing.lg },

  tabBarWrap: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    // Canvas-coloured, NOT transparent. The bar is laid out (not absolutely positioned), so a
    // transparent wrapper exposes the raw window background behind it — black on Android — which
    // reads as a flickering strip under the floating pill. The BlurView inside still frosts what
    // sits behind the pill; it just has the canvas to work with rather than a hole.
    backgroundColor: theme.color.background,
  },
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    // Translucent, not opaque: the BlurView behind it does the work. Fully opaque white would
    // throw away the frosted effect entirely.
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    borderRadius: theme.radii.pill,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    overflow: "hidden",
  },
  // Warm veil over the blur so labels keep contrast against busy content underneath.
  tabBarTint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 252, 252, 0.62)",
  },
  tabBarEdge: { position: "absolute", top: 0, left: 0, right: 0 },
  tabItemWrap: { flex: 1, alignItems: "center" },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 42,
    borderRadius: theme.radii.pill,
  },
  tabLabel: { ...theme.typography.caption, fontWeight: "800", color: theme.color.primary },
});
