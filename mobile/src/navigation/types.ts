import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

// Chunk 2 (Milestone 9) — real navigation replacing HomeScreen's local view-switching. The four
// bottom tabs live in their own navigator; every "pushed" screen (detail, create, certificate,
// blood profile) lives in the root stack that wraps the tabs, so it gets a real header + native
// back button regardless of which tab it was opened from.
import type { Need, ForumQuestion } from "../lib/api";

export type TabParamList = {
  Home: undefined;
  MyNeeds: undefined;
  Activity: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Tabs: undefined;
  NeedDetail: { needId: string; initialNeed?: Need };
  CreateNeedChooser: undefined;
  CreateMoney: undefined;
  CreateKit: undefined;
  CreateBlood: undefined;
  CreateMealSlot: undefined;
  CreateGoods: undefined;
  Certificate: { contributionId: string };
  BloodProfile: undefined;
  Register: { isSkippable?: boolean } | undefined;
  Forum: undefined;
  ForumQuestion: { questionId: string; initialQuestion?: ForumQuestion };
  CreateSkillRequest: undefined;
};

// Tab screens need to push root-stack screens (e.g. Home -> NeedDetail) — NeedDetail isn't a tab
// route, it's a parent-stack one. Typing tab screens' navigation against the root stack directly
// is the pragmatic option here (React Navigation resolves `navigate()` by searching up the
// navigator tree at runtime regardless of which prop type it was called through).
export type AppNavigationProp = NativeStackNavigationProp<RootStackParamList>;
