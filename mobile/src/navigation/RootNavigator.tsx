import { createNativeStackNavigator, type NativeStackScreenProps } from "@react-navigation/native-stack";
import { TabNavigator } from "./TabNavigator";
import { NeedDetailScreen } from "../screens/NeedDetailScreen";
import { CreateNeedChooserScreen } from "../screens/CreateNeedChooserScreen";
import { CreateMoneyNeedScreen } from "../screens/CreateMoneyNeedScreen";
import { CreateKitNeedScreen } from "../screens/CreateKitNeedScreen";
import { CreateBloodNeedScreen } from "../screens/CreateBloodNeedScreen";
import { CreateMealSlotNeedScreen } from "../screens/CreateMealSlotNeedScreen";
import { CreateGoodsNeedScreen } from "../screens/CreateGoodsNeedScreen";
import { CertificateScreen } from "../screens/CertificateScreen";
import { BloodProfileScreen } from "../screens/BloodProfileScreen";
import { theme } from "../lib/theme";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

type Props<Name extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, Name>;

// Thin adapters — every screen component still takes plain onBack/onDone/needId-style props
// (unchanged from before this chunk, minimizing the diff to their actual logic); these just
// translate that interface to/from React Navigation's route/navigation props in one place.
function NeedDetailRoute({ route }: Props<"NeedDetail">) {
  return <NeedDetailScreen needId={route.params.needId} />;
}
function CreateMoneyRoute({ navigation }: Props<"CreateMoney">) {
  return <CreateMoneyNeedScreen onDone={() => navigation.goBack()} />;
}
function CreateKitRoute({ navigation }: Props<"CreateKit">) {
  return <CreateKitNeedScreen onDone={() => navigation.goBack()} />;
}
function CreateBloodRoute({ navigation }: Props<"CreateBlood">) {
  return <CreateBloodNeedScreen onDone={() => navigation.goBack()} />;
}
function CreateMealSlotRoute({ navigation }: Props<"CreateMealSlot">) {
  return <CreateMealSlotNeedScreen onDone={() => navigation.goBack()} />;
}
function CreateGoodsRoute({ navigation }: Props<"CreateGoods">) {
  return <CreateGoodsNeedScreen onDone={() => navigation.goBack()} />;
}
function CertificateRoute({ route }: Props<"Certificate">) {
  return <CertificateScreen contributionId={route.params.contributionId} />;
}
function BloodProfileRoute({ navigation }: Props<"BloodProfile">) {
  return <BloodProfileScreen onBack={() => navigation.goBack()} />;
}

// Chunk 2 (Milestone 9) — the root stack: the tab navigator as one entry, every "pushed" screen
// (detail/create/certificate/blood-profile) as siblings so they slide over the tabs with a real
// native header + back button no matter which tab they were opened from.
export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerTitleStyle: theme.typography.h2, headerTintColor: theme.color.primary }}>
      <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="NeedDetail" component={NeedDetailRoute} options={{ title: "Need" }} />
      <Stack.Screen name="CreateNeedChooser" component={CreateNeedChooserScreen} options={{ title: "Post a need" }} />
      <Stack.Screen name="CreateMoney" component={CreateMoneyRoute} options={{ title: "Money need" }} />
      <Stack.Screen name="CreateKit" component={CreateKitRoute} options={{ title: "Kit need" }} />
      <Stack.Screen name="CreateBlood" component={CreateBloodRoute} options={{ title: "Blood need" }} />
      <Stack.Screen name="CreateMealSlot" component={CreateMealSlotRoute} options={{ title: "Meal-slot need" }} />
      <Stack.Screen name="CreateGoods" component={CreateGoodsRoute} options={{ title: "Goods need" }} />
      <Stack.Screen name="Certificate" component={CertificateRoute} options={{ title: "Certificate" }} />
      <Stack.Screen name="BloodProfile" component={BloodProfileRoute} options={{ title: "Blood donor profile" }} />
    </Stack.Navigator>
  );
}
