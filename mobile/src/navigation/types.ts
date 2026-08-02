import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

// Chunk 2 (Milestone 9) — real navigation replacing HomeScreen's local view-switching. The four
// bottom tabs live in their own navigator; every "pushed" screen (detail, create, certificate,
// blood profile) lives in the root stack that wraps the tabs, so it gets a real header + native
// back button regardless of which tab it was opened from.
import type { Need, ForumQuestion, Orphanage, Ngo, GoodsDirection } from "../lib/api";
import type { NeedCategory } from "../lib/needCategory";

export type TabParamList = {
  Home: undefined;
  Map: undefined;
  MyNeeds: undefined;
  Activity: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Tabs: undefined;
  NeedDetail: { needId: string; initialNeed?: Need };
  Notifications: undefined;
  Orphanages: undefined;
  OrphanageDetail: { orphanageId: string; initial?: Orphanage };
  BookSlot: { home: Orphanage };
  Ngos: undefined;
  NgoDetail: { ngoId: string; initial?: Ngo };
  Goods: undefined;
  /** Every live need filed under one cause — opened from the home-screen category grid. */
  CategoryNeeds: { category: NeedCategory };
  CreateNeedChooser: undefined;
  // Every create form carries the cause the poster picked in the chooser, so the need is filed
  // under the right category tile. Optional because a few entry points (the Goods screen's own
  // "give something away" button, deep links) reach these forms without going through the
  // chooser — the backend fills in a category itself when the type implies exactly one.
  CreateMoney: { category?: NeedCategory } | undefined;
  CreateKit: { category?: NeedCategory } | undefined;
  CreateBlood: { category?: NeedCategory } | undefined;
  CreateMealSlot: { category?: NeedCategory } | undefined;
  CreateGoods: { direction?: GoodsDirection; category?: NeedCategory } | undefined;
  Certificate: { contributionId: string };
  BloodProfile: undefined;
  Register: { isSkippable?: boolean } | undefined;
  Forum: undefined;
  ForumQuestion: { questionId: string; initialQuestion?: ForumQuestion };
  CreateSkillRequest: { category?: NeedCategory } | undefined;
};

// Tab screens need to push root-stack screens (e.g. Home -> NeedDetail) — NeedDetail isn't a tab
// route, it's a parent-stack one. Typing tab screens' navigation against the root stack directly
// is the pragmatic option here (React Navigation resolves `navigate()` by searching up the
// navigator tree at runtime regardless of which prop type it was called through).
export type AppNavigationProp = NativeStackNavigationProp<RootStackParamList>;
