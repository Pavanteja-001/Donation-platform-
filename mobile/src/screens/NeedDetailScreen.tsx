import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Alert,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import Animated, {
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import {
  bookMealSlot,
  claimGoods,
  confirmContribution,
  donate,
  donateKit,
  fetchContributions,
  fetchNeed,
  rejectContribution,
  respondToBloodNeed,
  signUpload,
  uploadToSignedUrl,
  type Contribution,
  type KitPayload,
  type MealSlotPayload,
  type Need,
} from "../lib/api";
import { buildUpiDeepLink, buildUpiQrCodeUrl } from "../lib/upi";
import { useAuth } from "../context/AuthContext";
import { useNavigation } from "@react-navigation/native";
import { isProfileComplete } from "../lib/profile";
import { shareNeedViaWhatsApp } from "../lib/whatsapp";
import { Feather, Ionicons } from "@expo/vector-icons";
import { theme } from "../lib/theme";
import {
  STATUS_BADGE_TONE,
  STATUS_LABEL,
  TYPE_META,
  isBloodPayload,
  isGoodsPayload,
  isKitPayload,
  isMealSlotPayload,
  isMoneyPayload,
  formatAmount,
  formatBloodGroup,
  formatDate,
  formatShortDate,
  type IconName,
} from "../lib/needMeta";
import { ProgressBar, type ProgressTone } from "../components/ProgressBar";
import { LiquidProgress } from "../components/LiquidProgress";
import { AnimatedCounter } from "../components/AnimatedCounter";
import { EmergencyPulse } from "../components/EmergencyPulse";
import { Gradient } from "../components/Gradient";
import { SuccessCelebration } from "../components/SuccessCelebration";
import { ErrorState, Button, Input, Chip, Card, Badge, Skeleton, PressableScale } from "../components/ui";

const HERO_HEIGHT = 260;

function formatContributionAmount(c: Contribution): string {
  if (c.kind === "BLOOD") return `${c.units} unit${c.units === 1 ? "" : "s"}`;
  if (c.kind === "KIT") return `${c.kits} kits`;
  if (c.kind === "MEAL_SLOT") {
    const date = c.mealSlotDate ? formatDate(c.mealSlotDate) : "";
    return c.amount != null ? `${formatAmount(c.amount)} · ${date}` : date;
  }
  if (c.kind === "GOODS") return "Claim";
  // `formatAmount` tolerates a null amount — DELIVER-mode contributions carry none (§9.2/§10.4),
  // and this used to render the string "₹undefined" for them.
  return formatAmount(c.amount);
}

/**
 * A UPI UTR (bank RRN) is exactly 12 digits. Donors paste straight from their bank SMS, so the
 * common "UTR: 1234 5678 9012" shape is normalised rather than rejected — the server applies the
 * identical rule, this just fails fast so the donor isn't told after a round-trip.
 */
function normaliseUtr(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/^(utr|rrn|ref|txn)[:\-]?/i, "");
}

const UTR_PATTERN = /^\d{12}$/;

const FUNDABLE: Need["status"][] = ["LIVE", "PARTIALLY_FULFILLED"];

/** Titled block with a tinted icon — gives every action card the same visual entry point. */
function SectionHeader({ icon, title, tone = theme.color.primary, tint = theme.color.primarySoft }: {
  icon: IconName;
  title: string;
  tone?: string;
  tint?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIcon, { backgroundColor: tint }]}>
        <Feather name={icon} size={15} color={tone} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

/** One key/value line in the meta grid (location, deadline, posted by). */
function MetaRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Feather name={icon} size={14} color={theme.color.textTertiary} />
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/** Replaces the bare ActivityIndicator — the layout appears before the data does. */
function DetailSkeleton() {
  return (
    <View style={styles.container}>
      <Skeleton width="100%" height={240} radius={0} />
      <View style={styles.skeletonSheet}>
        <View style={[styles.card, theme.elevation.level2, { gap: theme.spacing.md }]}>
          <Skeleton width={96} height={24} radius={theme.radii.pill} />
          <Skeleton width="85%" height={26} />
          <Skeleton width="100%" height={14} />
          <Skeleton width="92%" height={14} />
          <Skeleton width="60%" height={14} />
        </View>
        <View style={[styles.card, theme.elevation.level2, { gap: theme.spacing.md }]}>
          <Skeleton width="45%" height={28} />
          <Skeleton width="100%" height={10} radius={999} />
        </View>
      </View>
    </View>
  );
}

export function NeedDetailScreen({ needId, initialNeed }: { needId: string; initialNeed?: Need }) {
  const { token, user, bloodEligibility } = useAuth();
  const navigation = useNavigation<any>();
  const { width: screenWidth } = useWindowDimensions();
  const [need, setNeed] = useState<Need | null>(initialNeed || null);
  const [contributions, setContributions] = useState<Contribution[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePhoto, setActivePhoto] = useState(0);

  const [amount, setAmount] = useState("");
  const [utr, setUtr] = useState("");
  const [proofImage, setProofImage] = useState<{ uri: string; mimeType: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyContributionId, setBusyContributionId] = useState<string | null>(null);

  const [kitsInput, setKitsInput] = useState("");
  const [kitUtr, setKitUtr] = useState("");
  const [kitProofImage, setKitProofImage] = useState<{ uri: string; mimeType: string } | null>(null);
  const [isSubmittingKit, setIsSubmittingKit] = useState(false);

  const [isResponding, setIsResponding] = useState(false);
  const [hasResponded, setHasResponded] = useState(false);

  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [mealSlotUtr, setMealSlotUtr] = useState("");
  const [isBookingSlot, setIsBookingSlot] = useState(false);

  const [isClaiming, setIsClaiming] = useState(false);
  const [hasClaimed, setHasClaimed] = useState(false);

  // Replaces the Alert.alert() that used to close out every contribution flow.
  const [celebration, setCelebration] = useState<{ title: string; message: string } | null>(null);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  // Hero drifts at half scroll speed and scales up when over-scrolled downward, so pulling the
  // screen down stretches the photo instead of revealing a blank gap.
  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [-HERO_HEIGHT, 0, HERO_HEIGHT], [-HERO_HEIGHT / 2, 0, HERO_HEIGHT * 0.5], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [-HERO_HEIGHT, 0], [1.6, 1], Extrapolation.CLAMP) },
    ],
  }));

  // Badges fade out as the sheet rises over them — they'd otherwise clip awkwardly under it.
  const heroOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, HERO_HEIGHT * 0.5], [1, 0], Extrapolation.CLAMP),
  }));

  const isOwner = need && user && need.postedBy.id === user.id;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { need, myContribution } = await fetchNeed(token, needId);
      setNeed(need);

      if (myContribution) {
        if (myContribution.kind === "BLOOD") {
          setHasResponded(true);
        }
        if (myContribution.kind === "GOODS") {
          setHasClaimed(true);
        }
      }

      if (user && need.postedBy.id === user.id) {
        const { contributions } = await fetchContributions(token, needId);
        setContributions(contributions);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load this need");
    }
  }, [token, needId, user]);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePayViaUpi() {
    if (!need || !isMoneyPayload(need.payload)) return;
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert("Enter an amount first");
      return;
    }
    const link = buildUpiDeepLink({
      upiId: need.payload.upi_id,
      payeeName: need.postedBy.name ?? "Beneficiary",
      amount: parsedAmount,
      note: need.title,
    });
    const canOpen = await Linking.canOpenURL(link);
    if (canOpen) {
      Linking.openURL(link);
    } else {
      Alert.alert("No UPI app found", "Install a UPI app, or note the UPI ID and pay manually: " + need.payload.upi_id);
    }
  }

  async function handlePickProofImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo access to attach a payment screenshot.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setProofImage({ uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg" });
  }

  async function handleSubmitProof() {
    if (!token) return;
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (!UTR_PATTERN.test(normaliseUtr(utr))) {
      setError("Enter the 12-digit UTR / reference number shown in your payment app");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      let proofUrl: string | undefined;
      if (proofImage) {
        const signed = await signUpload(token, proofImage.mimeType, "contribution-proofs");
        await uploadToSignedUrl(signed.uploadUrl, proofImage.uri, proofImage.mimeType);
        proofUrl = signed.publicUrl;
      }
      await donate(token, needId, { amount: parsedAmount, utr: normaliseUtr(utr), proofUrl });
      setAmount("");
      setUtr("");
      setProofImage(null);
      setCelebration({
        title: "Thank you!",
        message: "Your donation is recorded and pending the beneficiary's confirmation.",
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit your contribution");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePayViaUpiForKit(kit: KitPayload) {
    if (!kit.upi_id) return;
    const parsedKits = Number(kitsInput);
    if (!parsedKits || parsedKits <= 0) {
      Alert.alert("Enter how many kits you're funding first");
      return;
    }
    const link = buildUpiDeepLink({
      upiId: kit.upi_id,
      payeeName: need?.postedBy.name ?? "Beneficiary",
      amount: parsedKits * kit.cost_per_kit,
      note: need?.title ?? "",
    });
    const canOpen = await Linking.canOpenURL(link);
    if (canOpen) {
      Linking.openURL(link);
    } else {
      Alert.alert("No UPI app found", "Install a UPI app, or note the UPI ID and pay manually: " + kit.upi_id);
    }
  }

  async function handlePickKitProofImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo access to attach a photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setKitProofImage({ uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg" });
  }

  async function handleSubmitKitContribution(kit: KitPayload) {
    if (!token) return;
    const parsedKits = Number(kitsInput);
    if (!parsedKits || parsedKits <= 0) {
      setError("Enter how many kits you're funding");
      return;
    }
    if (kit.mode === "MONEY" && !kitUtr.trim()) {
      setError("Enter the UTR from your payment");
      return;
    }
    setError(null);
    setIsSubmittingKit(true);
    try {
      let proofUrl: string | undefined;
      if (kitProofImage) {
        const signed = await signUpload(token, kitProofImage.mimeType, "contribution-proofs");
        await uploadToSignedUrl(signed.uploadUrl, kitProofImage.uri, kitProofImage.mimeType);
        proofUrl = signed.publicUrl;
      }
      await donateKit(token, needId, {
        kits: parsedKits,
        utr: kit.mode === "MONEY" ? normaliseUtr(kitUtr) : undefined,
        proofUrl,
      });
      setKitsInput("");
      setKitUtr("");
      setKitProofImage(null);
      setCelebration({
        title: "Thank you!",
        message:
          kit.mode === "MONEY"
            ? "Your contribution is pending the beneficiary's confirmation."
            : "Your delivery pledge is pending the beneficiary's confirmation.",
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit your contribution");
    } finally {
      setIsSubmittingKit(false);
    }
  }

  async function handleClaim() {
    if (!token) return;
    setIsClaiming(true);
    try {
      await claimGoods(token, needId);
      setHasClaimed(true);
      setCelebration({
        title: "Claim submitted",
        message: "The beneficiary can now see your claim and will reach out to coordinate handover.",
      });
      load();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to claim this item");
    } finally {
      setIsClaiming(false);
    }
  }

  async function handleRespond() {
    if (!token) return;
    if (!isProfileComplete(user)) {
      Alert.alert(
        "Complete Profile",
        "Responding to blood requests requires a completed profile (Full name, DOB, gender, blood group, city and area).",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Complete Profile", onPress: () => navigation.navigate("Register", { isSkippable: true }) },
        ]
      );
      return;
    }
    setIsResponding(true);
    try {
      await respondToBloodNeed(token, needId);
      setHasResponded(true);
      setCelebration({
        title: "You could save a life",
        message: "The beneficiary or hospital can now see your response and will coordinate with you.",
      });
      load();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to respond");
    } finally {
      setIsResponding(false);
    }
  }

  async function handleBookSlot(mealSlot: MealSlotPayload) {
    if (!token || !selectedSlotId) return;
    if (mealSlot.mode === "MONEY" && !mealSlotUtr.trim()) {
      setError("Enter the UTR from your payment");
      return;
    }
    setError(null);
    setIsBookingSlot(true);
    try {
      await bookMealSlot(token, needId, selectedSlotId, {
        utr: mealSlot.mode === "MONEY" ? normaliseUtr(mealSlotUtr) : undefined,
      });
      setSelectedSlotId(null);
      setMealSlotUtr("");
      setCelebration({
        title: "Date booked",
        message: "Your booking is pending the institution's confirmation.",
      });
      load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to book this date";
      Alert.alert("Couldn't book that date", message);
      setSelectedSlotId(null);
      load();
    } finally {
      setIsBookingSlot(false);
    }
  }

  async function handleDecision(contributionId: string, decision: "confirm" | "reject") {
    if (!token) return;
    setBusyContributionId(contributionId);
    try {
      await (decision === "confirm" ? confirmContribution : rejectContribution)(token, contributionId);
      load();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to update this contribution");
    } finally {
      setBusyContributionId(null);
    }
  }

  function handlePhotoScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    if (index !== activePhoto) setActivePhoto(index);
  }

  if (error && !need) {
    return (
      <View style={styles.centered}>
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  if (!need) {
    return <DetailSkeleton />;
  }

  const money = need.type === "MONEY" && isMoneyPayload(need.payload) ? need.payload : null;
  const canDonate = money && FUNDABLE.includes(need.status) && !isOwner;
  const kit = need.type === "KIT" && isKitPayload(need.payload) ? need.payload : null;
  const canDonateKit = kit && FUNDABLE.includes(need.status) && !isOwner;
  const blood = need.type === "BLOOD" && isBloodPayload(need.payload) ? need.payload : null;
  const canRespondToBlood = blood && FUNDABLE.includes(need.status) && !isOwner && !hasResponded;
  const mealSlot = need.type === "MEAL_SLOT" && isMealSlotPayload(need.payload) ? need.payload : null;
  const canBookMealSlot = mealSlot && FUNDABLE.includes(need.status) && !isOwner;
  // The list endpoints omit the mealSlots relation, so this is undefined until the detail
  // refetch lands. Normalised once here rather than guarded at each of the two read sites.
  const mealSlotDates = need.mealSlots ?? [];
  // Looked up rather than asserted with `!`: the selected id can outlive its slot if the need
  // refetches while a date is selected (e.g. someone else books it first, §10.3).
  const selectedSlot = mealSlotDates.find((s) => s.id === selectedSlotId);
  const goods = need.type === "GOODS" && isGoodsPayload(need.payload) ? need.payload : null;
  const canClaimGoods = goods && need.status === "LIVE" && !isOwner && !hasClaimed;
  const pendingContributions = contributions?.filter((c) => c.status === "PENDING_CONFIRMATION") ?? [];

  const meta = TYPE_META[need.type];
  const isEmergency = need.urgency === "EMERGENCY";
  const isBloodNeed = need.type === "BLOOD";
  // Blood/emergency CTAs use the deeper `blood` variant; everything else uses the brand crimson.
  const ctaVariant = isBloodNeed || isEmergency ? "blood" : "primary";
  const progressTone: ProgressTone = isBloodNeed ? "blood" : "primary";
  const location = [need.area, need.city].filter(Boolean).join(", ");
  const hasPhotos = need.photos.length > 0;

  return (
    <Animated.ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      {/* Full-bleed photo pager with a parallax drift. Badges sit on solid fills rather than over
          a scrim, so they stay legible on any photo without faking a gradient. */}
      {hasPhotos && (
        <Animated.View style={[styles.hero, heroStyle]}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handlePhotoScroll}
            scrollEventThrottle={16}
          >
            {need.photos.map((url) => (
              <ExpoImage
                key={url}
                source={{ uri: url }}
                style={{ width: screenWidth, height: HERO_HEIGHT }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={250}
              />
            ))}
          </ScrollView>

          {/* Crimson-tinted scrim: the reference photography is warm and dark at the edges, and
              this keeps overlaid badges readable on light photos too. */}
          <Gradient
            colors={theme.gradient.scrim}
            style={styles.heroScrim}
            bands={16}
            pointerEvents="none"
          />

          <Animated.View style={[styles.heroBadges, heroOverlayStyle]} pointerEvents="none">
            <Badge label={meta.label} icon={meta.icon} tone={isBloodNeed ? "blood" : "primary"} solid />
            {isEmergency && (
              <EmergencyPulse>
                <Badge label="Emergency" icon="alert-triangle" tone="blood" solid />
              </EmergencyPulse>
            )}
          </Animated.View>

          {need.photos.length > 1 && (
            <Animated.View style={[styles.heroDots, heroOverlayStyle]} pointerEvents="none">
              {need.photos.map((url, i) => (
                <View key={url} style={[styles.heroDot, i === activePhoto && styles.heroDotActive]} />
              ))}
            </Animated.View>
          )}
        </Animated.View>
      )}

      {/* Pulled up over the hero so the content sheet reads as a layer above the photo. */}
      <View style={[styles.sheet, hasPhotos && styles.sheetOverlapping]}>
        <Animated.View entering={FadeInDown.duration(360)}>
          <Card variant="hero">
            {!hasPhotos && (
              <View style={styles.typeGroup}>
                <View style={[styles.typeIcon, { backgroundColor: meta.tint }]}>
                  <Feather name={meta.icon} size={14} color={meta.color} />
                </View>
                <Text style={[styles.typeLabel, { color: meta.color }]}>{meta.label}</Text>
              </View>
            )}

            <Text style={styles.title}>{need.title}</Text>

            <View style={styles.badgeRow}>
              <Badge label={STATUS_LABEL[need.status]} tone={STATUS_BADGE_TONE[need.status]} />
              {isEmergency && !hasPhotos && <Badge label="Emergency" icon="alert-triangle" tone="blood" solid />}
              {need.urgency === "URGENT" && <Badge label="Urgent" icon="clock" tone="accent" />}
              {/* Solid, so it picks up the embossed relief — "Verified" is a state the donor is
                  trusting, and it should look stamped rather than tinted. */}
              {need.adminVerified && <Badge label="Verified" icon="check-circle" tone="success" solid />}
              {need.institutionVerified && <Badge label="Institution verified" icon="home" tone="info" />}
            </View>

            <Text style={styles.description}>{need.description}</Text>

            {/* deadline and postedBy exist on the model but were never surfaced before. */}
            <View style={styles.metaBlock}>
              {location ? <MetaRow icon="map-pin" label="Location" value={location} /> : null}
              {need.deadline ? (
                <MetaRow icon="calendar" label="Closes" value={formatShortDate(need.deadline)} />
              ) : null}
              <MetaRow icon="user" label="Posted by" value={need.postedBy.name ?? "Anonymous"} />
            </View>

            {need.status === "REJECTED" && need.rejectionReason && (
              // D-017 — a rejection must always show its reason to the poster.
              <View style={styles.rejectionBox}>
                <Feather name="x-circle" size={15} color={theme.color.danger} />
                <Text style={styles.rejectionText}>{need.rejectionReason}</Text>
              </View>
            )}
          </Card>
        </Animated.View>

        {/* Progress / type-specific stats */}
        <Animated.View entering={FadeInDown.delay(80).duration(360)}>
          <Card>
            {money && (
              <View style={styles.statBlock}>
                <View style={styles.amountRow}>
                  {/* Counts up on the UI thread — a static figure reads as a record, a rising one
                      reads as momentum. */}
                  <AnimatedCounter value={money.raised_amount} prefix="₹" style={styles.amount} />
                  <Text style={styles.amountTarget}>raised of {formatAmount(money.target_amount)}</Text>
                </View>
                <ProgressBar raised={money.raised_amount} target={money.target_amount} showLabel={false} height={10} />
              </View>
            )}

            {kit && (
              <View style={styles.statBlock}>
                <ProgressBar
                  raised={kit.kits_funded}
                  target={kit.kits_needed}
                  label={`${kit.kits_funded} of ${kit.kits_needed} kits funded`}
                  height={10}
                />
                <View style={styles.inlineNote}>
                  <Feather name="package" size={13} color={theme.color.textTertiary} />
                  <Text style={styles.inlineNoteText}>{kit.contents}</Text>
                </View>
              </View>
            )}

            {blood && (
              <View style={styles.statBlock}>
                <View style={styles.amountRow}>
                  {/* The pulse marks time-critical cases only (D-012) — a normal blood request
                      shows the same pill, still. */}
                  <EmergencyPulse active={isEmergency}>
                    <View style={styles.bloodGroupPill}>
                      <Feather name="droplet" size={15} color={theme.color.onBlood} />
                      <Text style={styles.bloodGroupText}>{formatBloodGroup(blood.blood_group)}</Text>
                    </View>
                  </EmergencyPulse>
                </View>
                {/* Liquid in a glass tube rather than a flat bar — blood units are a physical
                    quantity, and the count reads before the label does. The "N of M units" text
                    moved into the component so it sits flush with the tube's ends instead of
                    floating above it. */}
                <LiquidProgress
                  filled={blood.units_fulfilled}
                  total={blood.units_needed}
                  tone="blood"
                  height={18}
                  label={`${blood.units_fulfilled} of ${blood.units_needed} units`}
                />
              </View>
            )}

            {mealSlot && (
              <View style={styles.statBlock}>
                <ProgressBar
                  raised={mealSlot.slots_confirmed}
                  target={mealSlot.slots_total}
                  tone="accent"
                  label={`${mealSlot.slots_confirmed} of ${mealSlot.slots_total} slots confirmed`}
                  height={10}
                />
                <View style={styles.inlineNote}>
                  <Feather name="coffee" size={13} color={theme.color.textTertiary} />
                  <Text style={[styles.inlineNoteText, styles.capitalize]}>{mealSlot.meal_type}</Text>
                </View>
              </View>
            )}

            {goods && (
              <View style={styles.statBlock}>
                <Text style={styles.goodsItem}>{goods.item}</Text>
                <View style={styles.badgeRow}>
                  <Badge label={goods.condition} tone="neutral" />
                  <Badge
                    label={goods.claimed ? "Claimed" : "Available"}
                    tone={goods.claimed ? "neutral" : "success"}
                    icon={goods.claimed ? "check" : "gift"}
                  />
                </View>
              </View>
            )}

            {/* The official brand ramp (#25D366 → #128C7E) with a gloss on the lit half, rather
                than a flat green rectangle. The glyph is Ionicons' `logo-whatsapp`, which is the
                real mark — worth keeping rather than redrawing it as a path. */}
            <PressableScale onPress={() => shareNeedViaWhatsApp(need)} style={styles.whatsappButton}>
              <Gradient
                colors={["#3BE07A", "#25D366", "#128C7E"]}
                direction="diagonal"
                style={StyleSheet.absoluteFill as never}
                pointerEvents="none"
              />
              <Gradient
                colors={["rgba(255,255,255,0.30)", "rgba(255,255,255,0)"]}
                angle={{ start: { x: 0.2, y: 0 }, end: { x: 0.5, y: 0.9 } }}
                style={StyleSheet.absoluteFill as never}
                pointerEvents="none"
              />
              <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
              <Text style={styles.whatsappButtonText}>Share on WhatsApp</Text>
            </PressableScale>
          </Card>
        </Animated.View>

        {/* Money donation */}
        {canDonate && (
          <Animated.View entering={FadeInDown.delay(140).duration(360)}>
            <Card style={styles.actionCard}>
              <SectionHeader icon="heart" title="Donate funds" />

              <Input label="Amount" prefix="₹" placeholder="0" keyboardType="number-pad" value={amount} onChangeText={setAmount} />

              <Button variant="secondary" icon="external-link" label="Pay via UPI app" onPress={handlePayViaUpi} />
              <Text style={styles.upiId}>{money.upi_id}</Text>

              {Number(amount) > 0 && (
                <Animated.View entering={FadeIn.duration(theme.motion.normal)} style={styles.qrBlock}>
                  <Text style={styles.actionHint}>Or scan with GPay, PhonePe or Paytm</Text>
                  <View style={styles.qrFrame}>
                    <ExpoImage
                      source={{
                        uri: buildUpiQrCodeUrl({
                          upiId: money.upi_id,
                          payeeName: need.postedBy.name ?? "Beneficiary",
                          amount: Number(amount),
                          note: need.title,
                        }),
                      }}
                      style={styles.qrImage}
                      transition={200}
                    />
                  </View>
                </Animated.View>
              )}

              <View style={styles.divider} />

              <Text style={styles.actionHint}>
                After paying, enter the UTR from your payment so the beneficiary can confirm it.
              </Text>
              <Input label="UTR / reference number" placeholder="12-digit reference" value={utr} onChangeText={setUtr} />

              {proofImage ? (
                <View style={styles.proofPreviewRow}>
                  <ExpoImage source={{ uri: proofImage.uri }} style={styles.proofPreview} contentFit="cover" />
                  <Button label="Remove" variant="danger" size="sm" icon="trash-2" compact onPress={() => setProofImage(null)} />
                </View>
              ) : (
                <Button variant="secondary" size="sm" icon="paperclip" label="Attach payment screenshot" compact onPress={handlePickProofImage} />
              )}

              {error && <InlineError message={error} />}
              <Button label="Submit donation" icon="check" variant={ctaVariant} glow onPress={handleSubmitProof} loading={isSubmitting} />
            </Card>
          </Animated.View>
        )}

        {/* Kit funding */}
        {canDonateKit && (
          <Animated.View entering={FadeInDown.delay(140).duration(360)}>
            <Card style={styles.actionCard}>
              <SectionHeader icon="package" title={kit.mode === "MONEY" ? "Fund a kit" : "Pledge delivery"} />

              <Input label="Number of kits" placeholder="0" keyboardType="number-pad" value={kitsInput} onChangeText={setKitsInput} />

              {kit.mode === "MONEY" ? (
                <>
                  <Button
                    variant="secondary"
                    icon="external-link"
                    label="Pay via UPI app"
                    onPress={() => handlePayViaUpiForKit(kit)}
                  />
                  <Text style={styles.upiId}>{kit.upi_id}</Text>
                  <View style={styles.divider} />
                  <Text style={styles.actionHint}>After paying, enter the UTR from your payment below.</Text>
                  <Input label="UTR / reference number" placeholder="12-digit reference" value={kitUtr} onChangeText={setKitUtr} />
                </>
              ) : (
                <View style={styles.noticeBox}>
                  <Feather name="truck" size={15} color={theme.color.info} />
                  <Text style={styles.noticeText}>
                    No online payment required. Buy the kits yourself and deliver them to the location.
                  </Text>
                </View>
              )}

              {kitProofImage ? (
                <View style={styles.proofPreviewRow}>
                  <ExpoImage source={{ uri: kitProofImage.uri }} style={styles.proofPreview} contentFit="cover" />
                  <Button label="Remove" variant="danger" size="sm" icon="trash-2" compact onPress={() => setKitProofImage(null)} />
                </View>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  icon="paperclip"
                  compact
                  label={kit.mode === "MONEY" ? "Attach payment screenshot" : "Attach delivery photo"}
                  onPress={handlePickKitProofImage}
                />
              )}

              {error && <InlineError message={error} />}
              <Button
                label={kit.mode === "MONEY" ? "Submit contribution" : "Submit delivery pledge"}
                icon="check"
                variant={ctaVariant}
                glow
                onPress={() => handleSubmitKitContribution(kit)}
                loading={isSubmittingKit}
              />
            </Card>
          </Animated.View>
        )}

        {/* Blood response */}
        {canRespondToBlood && (
          <Animated.View entering={FadeInDown.delay(140).duration(360)}>
            <Card style={styles.actionCard}>
              <SectionHeader icon="droplet" title="Respond to this request" tone={theme.color.blood} tint={theme.color.bloodSoft} />

              {bloodEligibility && !bloodEligibility.hasProfile && (
                <View style={styles.noticeBox}>
                  <Feather name="info" size={15} color={theme.color.info} />
                  <Text style={styles.noticeText}>
                    You don't have a donor profile yet. Completing your profile helps us match you to needs automatically.
                  </Text>
                </View>
              )}

              {bloodEligibility?.hasProfile && !bloodEligibility.eligible && (
                <View style={styles.warningBox}>
                  <Feather name="alert-circle" size={15} color={theme.color.warning} />
                  <Text style={styles.warningText}>
                    You might not be eligible right now ({bloodEligibility.reasons.join("; ")}).
                  </Text>
                </View>
              )}

              <Text style={styles.actionHint}>
                Please only respond if you can donate. Tapping shares your contact details with the hospital so they can
                coordinate with you.
              </Text>

              <Button label="I can donate" icon="droplet" variant="blood" glow onPress={handleRespond} loading={isResponding} />
            </Card>
          </Animated.View>
        )}

        {blood && hasResponded && (
          <Animated.View entering={FadeInDown.delay(140).duration(360)}>
            <ConfirmationPanel
              icon="check-circle"
              text="Thank you. The beneficiary or hospital has your details and will get in touch shortly."
            />
          </Animated.View>
        )}

        {/* Meal slot booking */}
        {canBookMealSlot && (
          <Animated.View entering={FadeInDown.delay(140).duration(360)}>
            <Card style={styles.actionCard}>
              <SectionHeader icon="calendar" title="Book a date" tone="#8A5A00" tint={theme.color.accentSoft} />

              <Text style={styles.actionHint}>
                {mealSlot.mode === "MONEY"
                  ? `Select a date, pay ₹${mealSlot.cost_per_slot} via UPI, then confirm with the UTR.`
                  : "Select an open date you will cook and serve meals on."}
              </Text>

              {/* Empty until the detail refetch lands — the feed's `initialNeed` carries no
                  mealSlots, so this renders a loading row rather than crashing. */}
              {mealSlotDates.length === 0 ? (
                <View style={styles.slotsLoadingRow}>
                  <Skeleton width={104} height={40} radius={theme.radii.pill} />
                  <Skeleton width={104} height={40} radius={theme.radii.pill} />
                  <Skeleton width={104} height={40} radius={theme.radii.pill} />
                </View>
              ) : (
              <View style={styles.dateChipRow}>
                {mealSlotDates.map((slot) => {
                  const isOpen = slot.status === "OPEN";
                  const isSelected = selectedSlotId === slot.id;
                  return (
                    <Chip
                      key={slot.id}
                      label={`${formatDate(slot.date)}${!isOpen ? " · taken" : ""}`}
                      active={isSelected}
                      disabled={!isOpen}
                      onPress={() => setSelectedSlotId(isSelected ? null : slot.id)}
                    />
                  );
                })}
              </View>
              )}

              {selectedSlotId && (
                <Animated.View entering={FadeInDown.duration(300)} style={styles.actionCard}>
                  {mealSlot.mode === "MONEY" && (
                    <>
                      <Button
                        variant="secondary"
                        icon="external-link"
                        label="Pay via UPI app"
                        onPress={async () => {
                          const link = buildUpiDeepLink({
                            upiId: mealSlot.upi_id!,
                            payeeName: need.postedBy.name ?? "Institution",
                            amount: mealSlot.cost_per_slot,
                            note: need.title,
                          });
                          const canOpen = await Linking.canOpenURL(link);
                          if (canOpen) Linking.openURL(link);
                          else Alert.alert("No UPI app found", "Pay manually to: " + mealSlot.upi_id);
                        }}
                      />
                      <Text style={styles.upiId}>{mealSlot.upi_id}</Text>
                      <Input
                        label="UTR / reference number"
                        placeholder="12-digit reference"
                        value={mealSlotUtr}
                        onChangeText={setMealSlotUtr}
                      />
                    </>
                  )}
                  {error && <InlineError message={error} />}
                  <Button
                    label={selectedSlot ? `Book ${formatDate(selectedSlot.date)}` : "Book this date"}
                    icon="check"
                    glow
                    onPress={() => handleBookSlot(mealSlot)}
                    loading={isBookingSlot}
                  />
                </Animated.View>
              )}
            </Card>
          </Animated.View>
        )}

        {/* Goods claim */}
        {canClaimGoods && (
          <Animated.View entering={FadeInDown.delay(140).duration(360)}>
            <Card style={styles.actionCard}>
              <SectionHeader icon="box" title="Claim this item" tone={theme.color.info} tint={theme.color.infoSoft} />
              <Text style={styles.actionHint}>
                Only claim if you can personally provide this item and coordinate the handover.
              </Text>
              <Button label="I have this item" icon="gift" glow onPress={handleClaim} loading={isClaiming} />
            </Card>
          </Animated.View>
        )}

        {goods && hasClaimed && (
          <Animated.View entering={FadeInDown.delay(140).duration(360)}>
            <ConfirmationPanel
              icon="check-circle"
              text="Thanks! The beneficiary has your claim and will reach out to coordinate the handover."
            />
          </Animated.View>
        )}

        {/* Owner confirmation panel */}
        {isOwner && (
          <Animated.View entering={FadeInDown.delay(140).duration(360)}>
            <Card style={styles.actionCard}>
              <SectionHeader icon="inbox" title="Pending confirmations" />

              {pendingContributions.length === 0 ? (
                <View style={styles.emptyInline}>
                  <Feather name="check-circle" size={18} color={theme.color.textTertiary} />
                  <Text style={styles.emptyInlineText}>Nothing waiting on you right now.</Text>
                </View>
              ) : (
                pendingContributions.map((c) => {
                  const isBusy = busyContributionId === c.id;
                  const donorName = c.donor.name ?? c.donor.phone;
                  return (
                    <View key={c.id} style={styles.contributionCard}>
                      <View style={styles.contributionHeader}>
                        <View style={styles.donorAvatar}>
                          <Text style={styles.donorInitial}>{donorName.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={styles.contributionInfo}>
                          <Text style={styles.contributionAmount}>{formatContributionAmount(c)}</Text>
                          <Text style={styles.contributionDonor} numberOfLines={1}>
                            {donorName}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.utrChip}>
                        <Feather name={c.utr ? "hash" : "gift"} size={12} color={theme.color.textSecondary} />
                        <Text style={styles.contributionUtr} numberOfLines={1}>
                          {c.utr ?? (c.kind === "BLOOD" ? "Blood donation pledge" : "Delivery pledge")}
                        </Text>
                      </View>

                      <View style={styles.contributionActions}>
                        <View style={styles.actionSlot}>
                          <Button label="Confirm" icon="check" size="sm" onPress={() => handleDecision(c.id, "confirm")} disabled={isBusy} />
                        </View>
                        <View style={styles.actionSlot}>
                          <Button label="Reject" icon="x" size="sm" variant="danger" onPress={() => handleDecision(c.id, "reject")} disabled={isBusy} />
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </Card>
          </Animated.View>
        )}
      </View>

      <SuccessCelebration
        visible={celebration !== null}
        title={celebration?.title ?? ""}
        message={celebration?.message ?? ""}
        onDismiss={() => setCelebration(null)}
      />
    </Animated.ScrollView>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <Animated.View entering={FadeIn.duration(theme.motion.fast)} style={styles.errorBox}>
      <Feather name="alert-circle" size={15} color={theme.color.danger} />
      <Text style={styles.errorText}>{message}</Text>
    </Animated.View>
  );
}

/**
 * The "thank you" state after a donor pledges or contributes.
 *
 * This is the emotional high point of the whole flow, so it gets a soft green wash and a glowing
 * ring around the tick rather than the same white card as everything else — the moment should
 * feel like a reward, not a receipt.
 */
function ConfirmationPanel({ icon, text }: { icon: IconName; text: string }): ReactNode {
  return (
    <Card style={styles.confirmationCard}>
      <Gradient
        colors={["#EAFBF3", "#D6F5E7", "#BEEBD8"]}
        direction="diagonal"
        style={StyleSheet.absoluteFill as never}
        pointerEvents="none"
      />
      <View style={styles.confirmationGlow} pointerEvents="none" />
      <View style={styles.confirmationIcon}>
        <Gradient
          colors={["#34D399", "#0E9F6E", "#07684A"]}
          direction="diagonal"
          style={StyleSheet.absoluteFill as never}
          pointerEvents="none"
        />
        <Feather name={icon} size={22} color="#FFFFFF" />
      </View>
      <Text style={styles.confirmationText}>{text}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.background },
  content: { paddingBottom: theme.spacing.xxxl },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing.xl, backgroundColor: theme.color.background },

  hero: { backgroundColor: theme.color.surfaceMuted },
  // Bottom-anchored so the wash is strongest where the content sheet meets the photo.
  heroScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: HERO_HEIGHT * 0.55 },
  heroBadges: {
    position: "absolute",
    top: theme.spacing.lg,
    left: theme.spacing.lg,
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  heroDots: {
    position: "absolute",
    bottom: theme.spacing.xl + theme.spacing.md,
    alignSelf: "center",
    flexDirection: "row",
    gap: 6,
  },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.5)" },
  heroDotActive: { width: 18, backgroundColor: "#FFFFFF" },

  sheet: { padding: theme.spacing.lg, gap: theme.spacing.md },
  // Lifts the content sheet over the bottom of the hero photo.
  sheetOverlapping: { marginTop: -theme.spacing.xl, paddingTop: 0 },

  skeletonSheet: { padding: theme.spacing.lg, gap: theme.spacing.md, marginTop: -theme.spacing.xl },
  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radii.xxl,
    padding: theme.spacing.xl,
  },

  typeGroup: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  typeIcon: { width: 28, height: 28, borderRadius: theme.radii.xs, alignItems: "center", justifyContent: "center" },
  typeLabel: { ...theme.typography.overline, textTransform: "uppercase" },

  title: { ...theme.typography.h1, color: theme.color.textPrimary },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginTop: theme.spacing.md },
  description: { ...theme.typography.body, color: theme.color.textSecondary, marginTop: theme.spacing.md },

  metaBlock: {
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.color.borderSubtle,
    gap: theme.spacing.sm,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  metaLabel: { ...theme.typography.caption, color: theme.color.textTertiary, width: 72 },
  metaValue: { ...theme.typography.caption, color: theme.color.textPrimary, fontWeight: "700", flexShrink: 1 },

  rejectionBox: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    alignItems: "flex-start",
    backgroundColor: theme.color.dangerSoft,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  rejectionText: { ...theme.typography.bodySmall, color: theme.color.dangerDeep, flex: 1, fontWeight: "600" },

  statBlock: { gap: theme.spacing.md },
  amountRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: theme.spacing.sm },
  amount: { ...theme.typography.display, color: theme.color.textPrimary },
  amountTarget: { ...theme.typography.caption, color: theme.color.textSecondary, flexShrink: 1, textAlign: "right" },
  bloodGroupPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: theme.color.blood,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.pill,
  },
  bloodGroupText: { fontSize: 17, fontWeight: "800", color: theme.color.onBlood, letterSpacing: -0.3 },
  goodsItem: { ...theme.typography.h2, color: theme.color.textPrimary },
  inlineNote: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  inlineNoteText: { ...theme.typography.bodySmall, color: theme.color.textSecondary, flex: 1 },
  capitalize: { textTransform: "capitalize" },

  whatsappButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    backgroundColor: "#25D366",
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.lg,
    marginTop: theme.spacing.lg,
    // Clips the gradient layers to the rounded corners, and lifts the button off the card with
    // its own green-tinted shadow rather than the app's warm crimson one.
    overflow: "hidden",
    shadowColor: "#0B6B4F",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  whatsappButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },

  actionCard: { gap: theme.spacing.md },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  sectionIcon: { width: 30, height: 30, borderRadius: theme.radii.sm, alignItems: "center", justifyContent: "center" },
  sectionTitle: { ...theme.typography.h3, color: theme.color.textPrimary },

  actionHint: { ...theme.typography.bodySmall, color: theme.color.textSecondary },
  upiId: { ...theme.typography.caption, color: theme.color.textTertiary, textAlign: "center", marginTop: -theme.spacing.xs },
  divider: { height: 1, backgroundColor: theme.color.borderSubtle, marginVertical: theme.spacing.xs },

  qrBlock: { alignItems: "center", gap: theme.spacing.sm },
  qrFrame: {
    padding: theme.spacing.md,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  qrImage: { width: 150, height: 150 },

  noticeBox: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    alignItems: "flex-start",
    backgroundColor: theme.color.infoSoft,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
  },
  noticeText: { ...theme.typography.bodySmall, color: theme.color.textSecondary, flex: 1 },
  warningBox: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    alignItems: "flex-start",
    backgroundColor: theme.color.warningSoft,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
  },
  warningText: { ...theme.typography.bodySmall, color: "#92400E", flex: 1, fontWeight: "600" },

  dateChipRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  slotsLoadingRow: { flexDirection: "row", gap: theme.spacing.sm },
  proofPreviewRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  proofPreview: { width: 72, height: 72, borderRadius: theme.radii.md, backgroundColor: theme.color.surfaceMuted },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.color.dangerSoft,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
  },
  errorText: { ...theme.typography.bodySmall, color: theme.color.dangerDeep, flex: 1, fontWeight: "600" },

  confirmationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    overflow: "hidden",
    borderColor: "rgba(14,159,110,0.22)",
  },
  // Soft bloom behind the tick, so the icon reads as lit rather than pasted on the wash.
  confirmationGlow: {
    position: "absolute",
    left: -20,
    top: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(52,211,153,0.28)",
  },
  confirmationIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.pill,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#07684A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.34,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmationText: { ...theme.typography.bodySmall, color: theme.color.textPrimary, flex: 1, fontWeight: "600" },

  emptyInline: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, paddingVertical: theme.spacing.sm },
  emptyInlineText: { ...theme.typography.bodySmall, color: theme.color.textTertiary },

  contributionCard: {
    backgroundColor: theme.color.backgroundAlt,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  contributionHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  donorAvatar: {
    width: 38,
    height: 38,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.color.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  donorInitial: { fontSize: 15, fontWeight: "800", color: theme.color.primary },
  contributionInfo: { flex: 1, gap: 2 },
  contributionAmount: { ...theme.typography.bodyMedium, color: theme.color.textPrimary, fontWeight: "800" },
  contributionDonor: { ...theme.typography.caption, color: theme.color.textSecondary },
  utrChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: theme.color.surface,
    borderRadius: theme.radii.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 5,
  },
  contributionUtr: { ...theme.typography.caption, color: theme.color.textSecondary, flexShrink: 1 },
  contributionActions: { flexDirection: "row", gap: theme.spacing.sm },
  actionSlot: { flex: 1 },
});
