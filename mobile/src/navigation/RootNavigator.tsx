import { createNativeStackNavigator, type NativeStackScreenProps } from "@react-navigation/native-stack";
import { TabNavigator } from "./TabNavigator";
import { NeedDetailScreen } from "../screens/NeedDetailScreen";
import { CreateNeedChooserScreen } from "../screens/CreateNeedChooserScreen";
import { CreateMoneyNeedScreen } from "../screens/CreateMoneyNeedScreen";
import { CreateKitNeedScreen } from "../screens/CreateKitNeedScreen";
import { CreateBloodNeedScreen } from "../screens/CreateBloodNeedScreen";
import { CreateMealSlotNeedScreen } from "../screens/CreateMealSlotNeedScreen";
import { CreateGoodsNeedScreen } from "../screens/CreateGoodsNeedScreen";
import { CategoryNeedsScreen } from "../screens/CategoryNeedsScreen";
import { CertificateScreen } from "../screens/CertificateScreen";
import { BloodProfileScreen } from "../screens/BloodProfileScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { ForumScreen } from "../screens/ForumScreen";
import { ForumQuestionDetailScreen } from "../screens/ForumQuestionDetailScreen";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { OrphanagesScreen } from "../screens/OrphanagesScreen";
import { OrphanageDetailScreen } from "../screens/OrphanageDetailScreen";
import { BookSlotScreen } from "../screens/BookSlotScreen";
import { NgosScreen } from "../screens/NgosScreen";
import { NgoDetailScreen } from "../screens/NgoDetailScreen";
import { GoodsScreen } from "../screens/GoodsScreen";
import { CreateSkillRequestNeedScreen } from "../screens/CreateSkillRequestNeedScreen";
import { HelplinesScreen } from "../screens/HelplinesScreen";
import { SuccessStoriesScreen } from "../screens/SuccessStoriesScreen";
import { SuccessStoryDetailScreen } from "../screens/SuccessStoryDetailScreen";
import { TopSupportersScreen } from "../screens/TopSupportersScreen";
import { EventsScreen } from "../screens/EventsScreen";
import { EventDetailScreen } from "../screens/EventDetailScreen";
import { CATEGORY_LABELS } from "../lib/needCategory";
import { theme } from "../lib/theme";
import { useAuth } from "../context/AuthContext";
import { isProfileComplete } from "../lib/profile";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

type Props<Name extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, Name>;

// Thin adapters — every screen component still takes plain onBack/onDone/needId-style props
// (unchanged from before this chunk, minimizing the diff to their actual logic); these just
// translate that interface to/from React Navigation's route/navigation props in one place.
function NgosRoute({ navigation }: Props<"Ngos">) {
  return <NgosScreen onSelect={(ngo) => navigation.navigate("NgoDetail", { ngoId: ngo.id, initial: ngo })} />;
}

function NgoDetailRoute({ route }: Props<"NgoDetail">) {
  return <NgoDetailScreen ngoId={route.params.ngoId} initial={route.params.initial} />;
}

function OrphanagesRoute({ navigation }: Props<"Orphanages">) {
  return (
    <OrphanagesScreen
      onSelect={(home) => navigation.navigate("OrphanageDetail", { orphanageId: home.id, initial: home })}
    />
  );
}

function OrphanageDetailRoute({ navigation, route }: Props<"OrphanageDetail">) {
  return (
    <OrphanageDetailScreen
      orphanageId={route.params.orphanageId}
      initial={route.params.initial}
      onBook={(home) => navigation.navigate("BookSlot", { home })}
    />
  );
}

function BookSlotRoute({ navigation, route }: Props<"BookSlot">) {
  // Back to the home's page after booking, where the calendar now shows the slot as taken.
  return <BookSlotScreen home={route.params.home} onDone={() => navigation.goBack()} />;
}

function NotificationsRoute({ navigation }: Props<"Notifications">) {
  return <NotificationsScreen onOpenNeed={(needId) => navigation.navigate("NeedDetail", { needId })} />;
}

function NeedDetailRoute({ route }: Props<"NeedDetail">) {
  return <NeedDetailScreen needId={route.params.needId} initialNeed={route.params.initialNeed} />;
}
function CategoryNeedsRoute({ navigation, route }: Props<"CategoryNeeds">) {
  return (
    <CategoryNeedsScreen
      category={route.params.category}
      onSelectNeed={(need) => navigation.navigate("NeedDetail", { needId: need.id, initialNeed: need })}
    />
  );
}
function CreateMoneyRoute({ navigation, route }: Props<"CreateMoney">) {
  return <CreateMoneyNeedScreen category={route.params?.category} onDone={() => navigation.goBack()} />;
}
function CreateKitRoute({ navigation, route }: Props<"CreateKit">) {
  return <CreateKitNeedScreen category={route.params?.category} onDone={() => navigation.goBack()} />;
}
function CreateBloodRoute({ navigation, route }: Props<"CreateBlood">) {
  return <CreateBloodNeedScreen category={route.params?.category} onDone={() => navigation.goBack()} />;
}
function CreateMealSlotRoute({ navigation, route }: Props<"CreateMealSlot">) {
  return <CreateMealSlotNeedScreen category={route.params?.category} onDone={() => navigation.goBack()} />;
}
function CreateGoodsRoute({ navigation, route }: Props<"CreateGoods">) {
  return (
    <CreateGoodsNeedScreen
      direction={route.params?.direction ?? "REQUEST"}
      category={route.params?.category}
      onDone={() => navigation.goBack()}
    />
  );
}
function GoodsRoute({ navigation }: Props<"Goods">) {
  return (
    <GoodsScreen
      onSelectNeed={(need) => navigation.navigate("NeedDetail", { needId: need.id, initialNeed: need })}
      onDonateItem={() => navigation.navigate("CreateGoods", { direction: "OFFER" })}
      onRequestItem={() => navigation.navigate("CreateGoods", { direction: "REQUEST" })}
    />
  );
}
function CertificateRoute({ route }: Props<"Certificate">) {
  return <CertificateScreen contributionId={route.params.contributionId} />;
}
function BloodProfileRoute({ navigation }: Props<"BloodProfile">) {
  return <BloodProfileScreen onBack={() => navigation.goBack()} />;
}
function RegisterRoute({ navigation, route }: Props<"Register">) {
  const isSkippable = route.params?.isSkippable ?? true;
  return <RegisterScreen isSkippable={isSkippable} onDone={() => navigation.navigate("Tabs")} />;
}
function ForumRoute({ navigation }: Props<"Forum">) {
  return <ForumScreen onSelectQuestion={(q) => navigation.navigate("ForumQuestion", { questionId: q.id, initialQuestion: q })} />;
}
function ForumQuestionRoute({ route }: Props<"ForumQuestion">) {
  return <ForumQuestionDetailScreen questionId={route.params.questionId} initialQuestion={route.params.initialQuestion} />;
}
function CreateSkillRequestRoute({ navigation, route }: Props<"CreateSkillRequest">) {
  return <CreateSkillRequestNeedScreen category={route.params?.category} onDone={() => navigation.goBack()} />;
}

// --- Community panel (the menu drawer's "View all" destinations) -----------------------------
function SuccessStoriesRoute({ navigation }: Props<"SuccessStories">) {
  return (
    <SuccessStoriesScreen
      onSelect={(story) => navigation.navigate("SuccessStory", { storyId: story.id, initial: story })}
    />
  );
}
function SuccessStoryRoute({ route }: Props<"SuccessStory">) {
  return <SuccessStoryDetailScreen storyId={route.params.storyId} initial={route.params.initial} />;
}
function EventsRoute({ navigation }: Props<"Events">) {
  return <EventsScreen onSelect={(event) => navigation.navigate("EventDetail", { eventId: event.id, initial: event })} />;
}
function EventDetailRoute({ route }: Props<"EventDetail">) {
  return <EventDetailScreen eventId={route.params.eventId} initial={route.params.initial} />;
}

// Chunk 2 & 3 (Milestone 9) — the root stack: conditional initialRouteName based on profile completeness,
// containing the TabNavigator, detail/create/certificate/blood-profile/Register screens.
export function RootNavigator() {
  const { user } = useAuth();
  const profileComplete = isProfileComplete(user);

  return (
    <Stack.Navigator
      initialRouteName={profileComplete ? "Tabs" : "Register"}
      screenOptions={{ headerTitleStyle: theme.typography.h2, headerTintColor: theme.color.primary }}
    >
      <Stack.Screen name="Register" component={RegisterRoute} options={{ title: "Register Profile", headerShown: false }} />
      <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="NeedDetail" component={NeedDetailRoute} options={{ title: "Need" }} />
      <Stack.Screen
        name="CategoryNeeds"
        component={CategoryNeedsRoute}
        options={({ route }) => ({ title: CATEGORY_LABELS[route.params.category] })}
      />
      <Stack.Screen name="Notifications" component={NotificationsRoute} options={{ title: "Notifications" }} />
      <Stack.Screen name="Orphanages" component={OrphanagesRoute} options={{ title: "Orphanages & Old Age Homes" }} />
      <Stack.Screen name="OrphanageDetail" component={OrphanageDetailRoute} options={{ title: "Home details" }} />
      <Stack.Screen name="BookSlot" component={BookSlotRoute} options={{ title: "Book a slot" }} />
      <Stack.Screen name="Ngos" component={NgosRoute} options={{ title: "NGOs" }} />
      <Stack.Screen name="NgoDetail" component={NgoDetailRoute} options={{ title: "Organisation" }} />
      <Stack.Screen name="Goods" component={GoodsRoute} options={{ title: "Goods" }} />
      <Stack.Screen name="CreateNeedChooser" component={CreateNeedChooserScreen} options={{ title: "Post a need" }} />
      <Stack.Screen name="CreateMoney" component={CreateMoneyRoute} options={{ title: "Money need" }} />
      <Stack.Screen name="CreateKit" component={CreateKitRoute} options={{ title: "Kit need" }} />
      <Stack.Screen name="CreateBlood" component={CreateBloodRoute} options={{ title: "Blood need" }} />
      <Stack.Screen name="CreateMealSlot" component={CreateMealSlotRoute} options={{ title: "Meal-slot need" }} />
      <Stack.Screen
        name="CreateGoods"
        component={CreateGoodsRoute}
        // One route serves both directions, so the header has to read off the params — "Goods need"
        // is wrong for someone who tapped "Donate an item".
        options={({ route }) => ({
          title: route.params?.direction === "OFFER" ? "Donate an item" : "Request an item",
        })}
      />
      <Stack.Screen name="Certificate" component={CertificateRoute} options={{ title: "Certificate" }} />
      <Stack.Screen name="BloodProfile" component={BloodProfileRoute} options={{ title: "Blood donor profile" }} />
      <Stack.Screen name="Forum" component={ForumRoute} options={{ title: "Community Forum" }} />
      <Stack.Screen name="ForumQuestion" component={ForumQuestionRoute} options={{ title: "Question" }} />
      <Stack.Screen name="CreateSkillRequest" component={CreateSkillRequestRoute} options={{ title: "Volunteering need" }} />

      <Stack.Screen name="Helplines" component={HelplinesScreen} options={{ title: "Safety & emergency" }} />
      <Stack.Screen name="SuccessStories" component={SuccessStoriesRoute} options={{ title: "Success stories" }} />
      {/* Header title left generic: the story's own headline is the first thing on the page, and
          repeating it (truncated) in the nav bar just competes with it. */}
      <Stack.Screen name="SuccessStory" component={SuccessStoryRoute} options={{ title: "Story" }} />
      <Stack.Screen name="TopSupporters" component={TopSupportersScreen} options={{ title: "Top supporters" }} />
      <Stack.Screen name="Events" component={EventsRoute} options={{ title: "Events" }} />
      <Stack.Screen name="EventDetail" component={EventDetailRoute} options={{ title: "Event" }} />
    </Stack.Navigator>
  );
}
