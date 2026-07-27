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
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
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
import { ErrorState, Button, Input, Chip, Card, Badge, Skeleton, PressableScale } from "../components/ui";

function formatContributionAmount(c: Contribution): string {
  if (c.kind === "BLOOD") return `${c.units} unit${c.units === 1 ? "" : "s"}`;
  if (c.kind === "KIT") return `${c.kits} kits`;
  if (c.kind === "MEAL_SLOT") {
    const date = c.mealSlotDate ? formatDate(c.mealSlotDate) : "";
    return c.amount != null ? `₹${c.amount.toLocaleString("en-IN")} · ${date}` : date;
  }
  if (c.kind === "GOODS") return "Claim";
  return `₹${c.amount?.toLocaleString("en-IN")}`;
}

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
    if (!utr.trim()) {
      setError("Enter the UTR from your payment");
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
      await donate(token, needId, { amount: parsedAmount, utr: utr.trim(), proofUrl });
      setAmount("");
      setUtr("");
      setProofImage(null);
      Alert.alert("Thanks!", "Your contribution is pending the beneficiary's confirmation.");
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
        utr: kit.mode === "MONEY" ? kitUtr.trim() : undefined,
        proofUrl,
      });
      setKitsInput("");
      setKitUtr("");
      setKitProofImage(null);
      Alert.alert(
        "Thanks!",
        kit.mode === "MONEY"
          ? "Your contribution is pending the beneficiary's confirmation."
          : "Your delivery pledge is pending the beneficiary's confirmation."
      );
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
      Alert.alert("Thanks!", "The beneficiary can now see your claim to coordinate handover.");
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
      Alert.alert("Thanks!", "The beneficiary/hospital can now see your response to coordinate.");
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
        utr: mealSlot.mode === "MONEY" ? mealSlotUtr.trim() : undefined,
      });
      setSelectedSlotId(null);
      setMealSlotUtr("");
      Alert.alert("Thanks!", "Your booking is pending the institution's confirmation.");
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
  const goods = need.type === "GOODS" && isGoodsPayload(need.payload) ? need.payload : null;
  const canClaimGoods = goods && need.status === "LIVE" && !isOwner && !hasClaimed;
  const pendingContributions = contributions?.filter((c) => c.status === "PENDING_CONFIRMATION") ?? [];

  const meta = TYPE_META[need.type];
  const isEmergency = need.urgency === "EMERGENCY";
  const isBloodNeed = need.type === "BLOOD";
  // Blood and emergency needs drive their CTAs crimson; everything else stays on platform teal.
  const ctaVariant = isBloodNeed || isEmergency ? "blood" : "primary";
  const progressTone: ProgressTone = isBloodNeed ? "blood" : "primary";
  const location = [need.area, need.city].filter(Boolean).join(", ");
  const hasPhotos = need.photos.length > 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Full-bleed photo pager. Badges sit on solid fills rather than over a scrim, so they stay
          legible on any photo without faking a gradient. */}
      {hasPhotos && (
        <View style={styles.hero}>
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
                style={{ width: screenWidth, height: 260 }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={250}
              />
            ))}
          </ScrollView>

          <View style={styles.heroBadges} pointerEvents="none">
            <Badge label={meta.label} icon={meta.icon} tone={isBloodNeed ? "blood" : "primary"} solid />
            {isEmergency && <Badge label="Emergency" icon="alert-triangle" tone="blood" solid />}
          </View>

          {need.photos.length > 1 && (
            <View style={styles.heroDots} pointerEvents="none">
              {need.photos.map((url, i) => (
                <View key={url} style={[styles.heroDot, i === activePhoto && styles.heroDotActive]} />
              ))}
            </View>
          )}
        </View>
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
              {need.adminVerified && <Badge label="Verified" icon="check-circle" tone="success" />}
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
                  <Text style={styles.amount}>{formatAmount(money.raised_amount)}</Text>
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
                  <View style={styles.bloodGroupPill}>
                    <Feather name="droplet" size={15} color={theme.color.onBlood} />
                    <Text style={styles.bloodGroupText}>{formatBloodGroup(blood.blood_group)}</Text>
                  </View>
                  <Text style={styles.amountTarget}>
                    {blood.units_fulfilled} of {blood.units_needed} units
                  </Text>
                </View>
                <ProgressBar
                  raised={blood.units_fulfilled}
                  target={blood.units_needed}
                  tone={progressTone}
                  showLabel={false}
                  height={10}
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

            <PressableScale onPress={() => shareNeedViaWhatsApp(need)} style={styles.whatsappButton}>
              <Ionicons name="logo-whatsapp" size={19} color="#FFFFFF" />
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

              <View style={styles.dateChipRow}>
                {need.mealSlots.map((slot) => {
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
                    label={`Book ${formatDate(need.mealSlots.find((s) => s.id === selectedSlotId)!.date)}`}
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
    </ScrollView>
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

function ConfirmationPanel({ icon, text }: { icon: IconName; text: string }): ReactNode {
  return (
    <Card style={styles.confirmationCard}>
      <View style={styles.confirmationIcon}>
        <Feather name={icon} size={22} color={theme.color.success} />
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

  confirmationCard: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  confirmationIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.color.successSoft,
    alignItems: "center",
    justifyContent: "center",
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
