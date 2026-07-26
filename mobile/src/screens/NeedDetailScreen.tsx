import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import Animated, { FadeInDown } from "react-native-reanimated";
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
  type BloodPayload,
  type Contribution,
  type GoodsPayload,
  type KitPayload,
  type MealSlotPayload,
  type MoneyPayload,
  type Need,
} from "../lib/api";
import { buildUpiDeepLink } from "../lib/upi";
import { useAuth } from "../context/AuthContext";
import { useNavigation } from "@react-navigation/native";
import { isProfileComplete } from "../lib/profile";
import { theme } from "../lib/theme";
import { ProgressBar } from "../components/ProgressBar";
import { ErrorState, Button, Input, Chip, Card, Badge, type BadgeTone } from "../components/ui";

function isMoneyPayload(payload: Need["payload"]): payload is MoneyPayload {
  return !!payload && typeof (payload as MoneyPayload).target_amount === "number";
}

function isKitPayload(payload: Need["payload"]): payload is KitPayload {
  return !!payload && typeof (payload as KitPayload).kits_needed === "number";
}

function isBloodPayload(payload: Need["payload"]): payload is BloodPayload {
  return !!payload && typeof (payload as BloodPayload).units_needed === "number";
}

function isMealSlotPayload(payload: Need["payload"]): payload is MealSlotPayload {
  return !!payload && typeof (payload as MealSlotPayload).slots_total === "number";
}

function isGoodsPayload(payload: Need["payload"]): payload is GoodsPayload {
  return !!payload && typeof (payload as GoodsPayload).item === "string";
}

function formatBloodGroup(g: string) {
  return g.replace("_POSITIVE", "+").replace("_NEGATIVE", "-");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

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

const STATUS_BADGE_TONE: Record<Need["status"], BadgeTone> = {
  DRAFT: "neutral",
  PENDING_VERIFICATION: "accent",
  LIVE: "primary",
  PARTIALLY_FULFILLED: "primary",
  FULFILLED: "primary",
  REJECTED: "danger",
  EXPIRED: "danger",
  CANCELLED: "danger",
};

export function NeedDetailScreen({ needId }: { needId: string }) {
  const { token, user, bloodEligibility } = useAuth();
  const navigation = useNavigation<any>();
  const [need, setNeed] = useState<Need | null>(null);
  const [contributions, setContributions] = useState<Contribution[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (error && !need) {
    return (
      <View style={styles.centered}>
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  if (!need) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.color.primary} size="large" />
      </View>
    );
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Title Header Card */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        <Card elevated style={styles.headerCard}>
          <Text style={styles.title}>{need.title}</Text>
          <View style={styles.statusBadgeRow}>
            <Badge label={need.status.replace("_", " ")} tone={STATUS_BADGE_TONE[need.status]} />
            <Text style={styles.urgencyText}>{need.urgency}</Text>
          </View>
          <Text style={styles.description}>{need.description}</Text>

          {need.photos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
              {need.photos.map((url) => (
                <ExpoImage
                  key={url}
                  source={{ uri: url }}
                  style={styles.photo}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                />
              ))}
            </ScrollView>
          )}
        </Card>
      </Animated.View>

      {/* Progress Card */}
      <Animated.View entering={FadeInDown.delay(200).duration(400)}>
        <Card elevated style={styles.detailsCard}>
          {money && (
            <ProgressBar raised={money.raised_amount} target={money.target_amount} />
          )}
          {kit && (
            <View>
              <ProgressBar
                raised={kit.kits_funded}
                target={kit.kits_needed}
                label={`${kit.kits_funded} of ${kit.kits_needed} kits funded`}
              />
              <Text style={styles.detailsHint}>Kit Contents: {kit.contents}</Text>
            </View>
          )}
          {blood && (
            <View>
              <Text style={styles.bloodGroup}>{formatBloodGroup(blood.blood_group)} Blood Needed</Text>
              <ProgressBar
                raised={blood.units_fulfilled}
                target={blood.units_needed}
                label={`${blood.units_fulfilled} of ${blood.units_needed} units`}
              />
            </View>
          )}
          {mealSlot && (
            <View>
              <Text style={styles.mealType}>{mealSlot.meal_type}</Text>
              <ProgressBar
                raised={mealSlot.slots_confirmed}
                target={mealSlot.slots_total}
                label={`${mealSlot.slots_confirmed} of ${mealSlot.slots_total} slots confirmed`}
              />
            </View>
          )}
          {goods && (
            <View>
              <Text style={styles.mealType}>{goods.item}</Text>
              <Text style={styles.detailsHint}>Condition: {goods.condition}</Text>
              <View style={styles.badgeRow}>
                <Badge
                  label={goods.claimed ? "Claimed" : "Available"}
                  tone={goods.claimed ? "danger" : "primary"}
                />
              </View>
            </View>
          )}

          {need.status === "REJECTED" && need.rejectionReason && (
            <Text style={styles.rejection}>Rejected: {need.rejectionReason}</Text>
          )}
        </Card>
      </Animated.View>

      {/* UPI Donation Action Card */}
      {canDonate && (
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <Card elevated style={styles.actionCard}>
            <Text style={styles.sectionTitle}>Donate Funds</Text>
            <Input
              placeholder="Amount (₹)"
              keyboardType="number-pad"
              value={amount}
              onChangeText={setAmount}
            />
            <Button
              variant="secondary"
              label={`Pay via UPI (${money.upi_id})`}
              onPress={handlePayViaUpi}
            />
            <Text style={styles.actionHint}>After paying, enter the payment UTR number to submit your proof.</Text>
            <Input
              placeholder="12-digit UTR / reference number"
              value={utr}
              onChangeText={setUtr}
            />

            {proofImage ? (
              <View style={styles.proofPreviewRow}>
                <ExpoImage source={{ uri: proofImage.uri }} style={styles.proofPreview} />
                <Button label="Remove Image" variant="danger" onPress={() => setProofImage(null)} />
              </View>
            ) : (
              <View style={styles.uploadBtnRow}>
                <Button variant="secondary" label="Attach Payment Screenshot" onPress={handlePickProofImage} />
              </View>
            )}

            {error && <Text style={styles.errorText}>{error}</Text>}
            <Button
              label="Submit Donation Confirmation"
              onPress={handleSubmitProof}
              loading={isSubmitting}
            />
          </Card>
        </Animated.View>
      )}

      {/* Kit Funding Action Card */}
      {canDonateKit && (
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <Card elevated style={styles.actionCard}>
            <Text style={styles.sectionTitle}>{kit.mode === "MONEY" ? "Fund a Kit" : "Pledge Delivery"}</Text>
            <Input
              placeholder="Number of kits"
              keyboardType="number-pad"
              value={kitsInput}
              onChangeText={setKitsInput}
            />

            {kit.mode === "MONEY" ? (
              <>
                <Button
                  variant="secondary"
                  label={`Pay via UPI (${kit.upi_id})`}
                  onPress={() => handlePayViaUpiForKit(kit)}
                />
                <Text style={styles.actionHint}>After paying, enter the payment UTR number below.</Text>
                <Input
                  placeholder="12-digit UTR / reference number"
                  value={kitUtr}
                  onChangeText={setKitUtr}
                />
              </>
            ) : (
              <Text style={styles.actionHint}>
                No online payment required. Buy the kits yourself and deliver them to the location.
              </Text>
            )}

            {kitProofImage ? (
              <View style={styles.proofPreviewRow}>
                <ExpoImage source={{ uri: kitProofImage.uri }} style={styles.proofPreview} />
                <Button label="Remove Photo" variant="danger" onPress={() => setKitProofImage(null)} />
              </View>
            ) : (
              <View style={styles.uploadBtnRow}>
                <Button
                  variant="secondary"
                  label={kit.mode === "MONEY" ? "Attach Payment Screenshot" : "Attach Delivery Photo"}
                  onPress={handlePickKitProofImage}
                />
              </View>
            )}

            {error && <Text style={styles.errorText}>{error}</Text>}
            <Button
              label={kit.mode === "MONEY" ? "Submit Contribution" : "Submit Delivery Pledge"}
              onPress={() => handleSubmitKitContribution(kit)}
              loading={isSubmittingKit}
            />
          </Card>
        </Animated.View>
      )}

      {/* Blood Respond Action Card */}
      {canRespondToBlood && (
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <Card elevated style={styles.actionCard}>
            <Text style={styles.sectionTitle}>Respond to Blood Need</Text>
            {bloodEligibility && !bloodEligibility.hasProfile && (
              <Text style={styles.actionHint}>
                You don't have a donor profile yet. Completing your profile from home screen helps match automatic needs.
              </Text>
            )}
            {bloodEligibility?.hasProfile && !bloodEligibility.eligible && (
              <Text style={styles.warningHint}>
                Heads up: You might not be eligible right now ({bloodEligibility.reasons.join("; ")}).
              </Text>
            )}
            <Text style={styles.actionHint}>
              Please only respond if you can donate. Tapping will share your contact info with the hospital to coordinate.
            </Text>
            <Button
              label="I Can Donate"
              onPress={handleRespond}
              loading={isResponding}
            />
          </Card>
        </Animated.View>
      )}

      {blood && hasResponded && (
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <Card elevated style={styles.actionCard}>
            <Text style={styles.thankYouText}>
              Thank you! The beneficiary/hospital has received your details and will get in touch shortly.
            </Text>
          </Card>
        </Animated.View>
      )}

      {/* Meal Date Booking Action Card */}
      {canBookMealSlot && (
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <Card elevated style={styles.actionCard}>
            <Text style={styles.sectionTitle}>Book a Date</Text>
            <Text style={styles.actionHint}>
              {mealSlot.mode === "MONEY"
                ? `Select a date, pay ₹${mealSlot.cost_per_slot} via UPI (${mealSlot.upi_id}), and confirm with UTR.`
                : "Select an open date you will cook and serve meals on."}
            </Text>

            <View style={styles.dateChipRow}>
              {need.mealSlots.map((slot) => {
                const isOpen = slot.status === "OPEN";
                const isSelected = selectedSlotId === slot.id;
                return (
                  <Chip
                    key={slot.id}
                    label={`${formatDate(slot.date)}${!isOpen ? " (taken)" : ""}`}
                    active={isSelected}
                    disabled={!isOpen}
                    onPress={() => setSelectedSlotId(isSelected ? null : slot.id)}
                  />
                );
              })}
            </View>

            {selectedSlotId && (
              <Animated.View entering={FadeInDown.duration(300)}>
                {mealSlot.mode === "MONEY" && (
                  <>
                    <Button
                      variant="secondary"
                      label={`Pay via UPI (${mealSlot.upi_id})`}
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
                    <Input
                      placeholder="12-digit UTR / reference number"
                      value={mealSlotUtr}
                      onChangeText={setMealSlotUtr}
                    />
                  </>
                )}
                {error && <Text style={styles.errorText}>{error}</Text>}
                <Button
                  label={`Book ${formatDate(need.mealSlots.find((s) => s.id === selectedSlotId)!.date)}`}
                  onPress={() => handleBookSlot(mealSlot)}
                  loading={isBookingSlot}
                />
              </Animated.View>
            )}
          </Card>
        </Animated.View>
      )}

      {/* Goods Claim Action Card */}
      {canClaimGoods && (
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <Card elevated style={styles.actionCard}>
            <Text style={styles.sectionTitle}>Claim This Item</Text>
            <Text style={styles.actionHint}>
              Only claim if you can personally provide and coordinate the handover of this item.
            </Text>
            <Button
              label="I Have This Item"
              onPress={handleClaim}
              loading={isClaiming}
            />
          </Card>
        </Animated.View>
      )}

      {goods && hasClaimed && (
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <Card elevated style={styles.actionCard}>
            <Text style={styles.thankYouText}>
              Thanks! The beneficiary has your claim and will reach out to coordinate handover.
            </Text>
          </Card>
        </Animated.View>
      )}

      {/* Owner Confirmation Panel */}
      {isOwner && (
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <Card elevated style={styles.ownerCard}>
            <Text style={styles.sectionTitle}>Pending Confirmations</Text>
            {pendingContributions.length === 0 && (
              <Text style={styles.noPendingText}>No pending contributions to confirm right now.</Text>
            )}
            {pendingContributions.map((c) => (
              <Card key={c.id} style={styles.contributionCard}>
                <Text style={styles.contributionAmount}>
                  {formatContributionAmount(c)} · {c.donor.name ?? c.donor.phone}
                </Text>
                <Text style={styles.contributionUtr}>
                  {c.utr ? `UTR: ${c.utr}` : c.kind === "BLOOD" ? "Blood donation pledge" : "Delivery pledge"}
                </Text>
                <View style={styles.contributionActions}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Confirm"
                      onPress={() => handleDecision(c.id, "confirm")}
                      disabled={busyContributionId === c.id}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Reject"
                      variant="danger"
                      onPress={() => handleDecision(c.id, "reject")}
                      disabled={busyContributionId === c.id}
                    />
                  </View>
                </View>
              </Card>
            ))}
          </Card>
        </Animated.View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.background },
  content: { padding: theme.spacing.lg, paddingBottom: 40, gap: theme.spacing.md },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing.xl },
  headerCard: { padding: theme.spacing.xl, borderRadius: theme.radius * 1.5 },
  title: { fontSize: 22, fontWeight: "700", color: theme.color.textPrimary },
  statusBadgeRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, marginTop: theme.spacing.xs, marginBottom: theme.spacing.md },
  urgencyText: { fontSize: 12, color: theme.color.textSecondary, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  description: { fontSize: 15, color: theme.color.textPrimary, lineHeight: 22 },
  photoRow: { marginTop: theme.spacing.md },
  photo: { width: 140, height: 100, borderRadius: theme.radius, marginRight: theme.spacing.sm, backgroundColor: theme.color.border },
  detailsCard: { padding: theme.spacing.lg },
  detailsHint: { fontSize: 13, color: theme.color.textSecondary, marginTop: theme.spacing.sm, fontWeight: "500" },
  badgeRow: { marginTop: theme.spacing.sm, flexDirection: "row" },
  rejection: { color: theme.color.danger, marginTop: theme.spacing.md, fontSize: 14, fontWeight: "600" },
  actionCard: { padding: theme.spacing.xl, gap: theme.spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: theme.color.textPrimary },
  bloodGroup: { fontSize: 16, fontWeight: "700", color: theme.color.danger, marginBottom: theme.spacing.sm },
  mealType: { fontSize: 16, fontWeight: "700", color: theme.color.primary, marginBottom: theme.spacing.sm, textTransform: "capitalize" },
  actionHint: { fontSize: 13, color: theme.color.textSecondary, lineHeight: 18, fontWeight: "500" },
  warningHint: { fontSize: 13, color: theme.color.warning, lineHeight: 18, fontWeight: "600" },
  dateChipRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  proofPreviewRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, marginTop: theme.spacing.xs },
  proofPreview: { width: 64, height: 64, borderRadius: theme.radius, backgroundColor: theme.color.border },
  uploadBtnRow: { alignSelf: "flex-start" },
  errorText: { color: theme.color.danger, fontSize: 13, fontWeight: "500" },
  thankYouText: { fontSize: 15, fontWeight: "600", color: theme.color.primary, textAlign: "center", lineHeight: 22 },
  ownerCard: { padding: theme.spacing.xl, gap: theme.spacing.md },
  noPendingText: { fontSize: 13, color: theme.color.textSecondary, fontWeight: "500", fontStyle: "italic" },
  contributionCard: { padding: theme.spacing.md, borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.background, marginTop: theme.spacing.sm },
  contributionAmount: { fontSize: 14, fontWeight: "700", color: theme.color.textPrimary },
  contributionUtr: { fontSize: 12, color: theme.color.textSecondary, marginTop: 2, fontWeight: "500" },
  contributionActions: { flexDirection: "row", gap: theme.spacing.md, marginTop: theme.spacing.md },
});
