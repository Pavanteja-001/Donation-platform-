import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
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
import { theme } from "../lib/theme";
import { ProgressBar } from "../components/ProgressBar";

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

export function NeedDetailScreen({ needId, onBack }: { needId: string; onBack: () => void }) {
  const { token, user, bloodEligibility } = useAuth();
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
      const { need } = await fetchNeed(token, needId);
      setNeed(need);
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
    if (!kit.upi_id) return; // shouldn't happen — backend requires upi_id when mode=MONEY
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

  // PRD §11.3 — "claim it." A pledge, not a payment, same consent principle as blood's respond.
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

  // PRD §8.5.1 — "I can donate." A pledge, not a payment; responding is itself the donor's
  // consent to share their response with the beneficiary/institution.
  async function handleRespond() {
    if (!token) return;
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

  // PRD §10.3-10.4 / D-022 — booking a specific date. A 409 here means someone else booked it
  // first (the locking working as intended, not a bug) — refetch so the donor sees it's gone
  // and can pick another.
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
      load(); // refresh the calendar — the date may have just been taken
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
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backLink}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!need) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.color.primary} />
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
  // §11.3 — no PARTIALLY_FULFILLED for GOODS (one-shot claim), so only LIVE is claimable.
  const canClaimGoods = goods && need.status === "LIVE" && !isOwner && !hasClaimed;
  const pendingContributions = contributions?.filter((c) => c.status === "PENDING_CONFIRMATION") ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backLink}>‹ Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{need.title}</Text>
      <Text style={styles.status}>
        {need.status.replace("_", " ")} · {need.urgency}
      </Text>
      <Text style={styles.description}>{need.description}</Text>

      {need.photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
          {need.photos.map((url) => (
            <ExpoImage key={url} source={{ uri: url }} style={styles.photo} contentFit="cover" cachePolicy="memory-disk" />
          ))}
        </ScrollView>
      )}

      {money && (
        <View style={styles.section}>
          <ProgressBar raised={money.raised_amount} target={money.target_amount} />
        </View>
      )}
      {kit && (
        <View style={styles.section}>
          <ProgressBar
            raised={kit.kits_funded}
            target={kit.kits_needed}
            label={`${kit.kits_funded} of ${kit.kits_needed} kits funded`}
          />
          <Text style={styles.hint}>{kit.contents}</Text>
        </View>
      )}
      {blood && (
        <View style={styles.section}>
          <Text style={styles.bloodGroup}>{formatBloodGroup(blood.blood_group)}</Text>
          <ProgressBar
            raised={blood.units_fulfilled}
            target={blood.units_needed}
            label={`${blood.units_fulfilled} of ${blood.units_needed} units`}
          />
        </View>
      )}
      {mealSlot && (
        <View style={styles.section}>
          <Text style={styles.mealType}>{mealSlot.meal_type}</Text>
          <ProgressBar
            raised={mealSlot.slots_confirmed}
            target={mealSlot.slots_total}
            label={`${mealSlot.slots_confirmed} of ${mealSlot.slots_total} slots confirmed`}
          />
        </View>
      )}
      {goods && (
        <View style={styles.section}>
          <Text style={styles.mealType}>{goods.item}</Text>
          <Text style={styles.hint}>Acceptable condition: {goods.condition}</Text>
          <Text style={styles.hint}>{goods.claimed ? "Claimed" : "Not yet claimed"}</Text>
        </View>
      )}

      {need.status === "REJECTED" && need.rejectionReason && (
        <Text style={styles.rejection}>Rejected: {need.rejectionReason}</Text>
      )}

      {canDonate && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Donate</Text>
          <TextInput
            style={styles.input}
            placeholder="Amount (₹)"
            placeholderTextColor={theme.color.textSecondary}
            keyboardType="number-pad"
            value={amount}
            onChangeText={setAmount}
          />
          <TouchableOpacity style={styles.secondaryButton} onPress={handlePayViaUpi}>
            <Text style={styles.secondaryButtonText}>Pay via UPI ({money.upi_id})</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>After paying, enter the UTR from your payment to confirm your contribution.</Text>
          <TextInput
            style={styles.input}
            placeholder="UTR / reference number"
            placeholderTextColor={theme.color.textSecondary}
            value={utr}
            onChangeText={setUtr}
          />

          {proofImage ? (
            <View style={styles.proofPreviewRow}>
              <Image source={{ uri: proofImage.uri }} style={styles.proofPreview} />
              <TouchableOpacity onPress={() => setProofImage(null)}>
                <Text style={styles.link}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.secondaryButton} onPress={handlePickProofImage}>
              <Text style={styles.secondaryButtonText}>Attach payment screenshot (optional)</Text>
            </TouchableOpacity>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}
          <TouchableOpacity
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleSubmitProof}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={theme.color.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>Submit contribution</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {canDonateKit && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{kit.mode === "MONEY" ? "Fund a kit" : "Pledge to deliver"}</Text>
          <TextInput
            style={styles.input}
            placeholder="Number of kits"
            placeholderTextColor={theme.color.textSecondary}
            keyboardType="number-pad"
            value={kitsInput}
            onChangeText={setKitsInput}
          />

          {kit.mode === "MONEY" ? (
            <>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => handlePayViaUpiForKit(kit)}>
                <Text style={styles.secondaryButtonText}>Pay via UPI ({kit.upi_id})</Text>
              </TouchableOpacity>
              <Text style={styles.hint}>After paying, enter the UTR from your payment to confirm your contribution.</Text>
              <TextInput
                style={styles.input}
                placeholder="UTR / reference number"
                placeholderTextColor={theme.color.textSecondary}
                value={kitUtr}
                onChangeText={setKitUtr}
              />
            </>
          ) : (
            <Text style={styles.hint}>
              No payment needed — buy the kits yourself and deliver them, then submit your pledge. The
              beneficiary confirms once they're received.
            </Text>
          )}

          {kitProofImage ? (
            <View style={styles.proofPreviewRow}>
              <Image source={{ uri: kitProofImage.uri }} style={styles.proofPreview} />
              <TouchableOpacity onPress={() => setKitProofImage(null)}>
                <Text style={styles.link}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.secondaryButton} onPress={handlePickKitProofImage}>
              <Text style={styles.secondaryButtonText}>
                {kit.mode === "MONEY" ? "Attach payment screenshot (optional)" : "Attach delivery photo (optional)"}
              </Text>
            </TouchableOpacity>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}
          <TouchableOpacity
            style={[styles.button, isSubmittingKit && styles.buttonDisabled]}
            onPress={() => handleSubmitKitContribution(kit)}
            disabled={isSubmittingKit}
          >
            {isSubmittingKit ? (
              <ActivityIndicator color={theme.color.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>{kit.mode === "MONEY" ? "Submit contribution" : "Submit pledge"}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {canRespondToBlood && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Respond</Text>
          {bloodEligibility && !bloodEligibility.hasProfile && (
            <Text style={styles.hint}>
              You don't have a blood donor profile yet — you can still respond, but filling one in
              (from the home screen) helps you get matched to nearby requests automatically.
            </Text>
          )}
          {bloodEligibility?.hasProfile && !bloodEligibility.eligible && (
            <Text style={styles.hint}>
              Heads up: based on your profile you may not be eligible right now ({bloodEligibility.reasons.join("; ")}
              ) — you can still respond if you know this need is different (e.g. a different donor).
            </Text>
          )}
          <Text style={styles.hint}>
            Only respond if you can actually donate — this shares your contact details with the
            beneficiary/hospital so they can coordinate with you directly.
          </Text>
          <TouchableOpacity
            style={[styles.button, isResponding && styles.buttonDisabled]}
            onPress={handleRespond}
            disabled={isResponding}
          >
            {isResponding ? <ActivityIndicator color={theme.color.onPrimary} /> : <Text style={styles.buttonText}>I can donate</Text>}
          </TouchableOpacity>
        </View>
      )}
      {blood && hasResponded && (
        <View style={styles.section}>
          <Text style={styles.hint}>
            Thanks — the beneficiary/hospital has your response and can now see your contact
            details to coordinate.
          </Text>
        </View>
      )}

      {canBookMealSlot && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Book a date</Text>
          <Text style={styles.hint}>
            {mealSlot.mode === "MONEY"
              ? `Pick an open date, pay ₹${mealSlot.cost_per_slot} via UPI (${mealSlot.upi_id}), then submit the UTR.`
              : "Pick an open date you can personally cook/serve on."}
          </Text>
          <View style={styles.dateChipRow}>
            {need.mealSlots.map((slot) => {
              const isOpen = slot.status === "OPEN";
              const isSelected = selectedSlotId === slot.id;
              return (
                <TouchableOpacity
                  key={slot.id}
                  disabled={!isOpen}
                  style={[
                    styles.dateChip,
                    !isOpen && styles.dateChipTaken,
                    isSelected && styles.dateChipSelected,
                  ]}
                  onPress={() => setSelectedSlotId(isSelected ? null : slot.id)}
                >
                  <Text
                    style={[
                      styles.dateChipText,
                      !isOpen && styles.dateChipTextTaken,
                      isSelected && styles.dateChipTextSelected,
                    ]}
                  >
                    {formatDate(slot.date)}
                    {!isOpen ? " (taken)" : ""}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedSlotId && (
            <>
              {mealSlot.mode === "MONEY" && (
                <>
                  <TouchableOpacity
                    style={styles.secondaryButton}
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
                  >
                    <Text style={styles.secondaryButtonText}>Pay via UPI ({mealSlot.upi_id})</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.input}
                    placeholder="UTR / reference number"
                    placeholderTextColor={theme.color.textSecondary}
                    value={mealSlotUtr}
                    onChangeText={setMealSlotUtr}
                  />
                </>
              )}
              {error && <Text style={styles.errorText}>{error}</Text>}
              <TouchableOpacity
                style={[styles.button, isBookingSlot && styles.buttonDisabled]}
                onPress={() => handleBookSlot(mealSlot)}
                disabled={isBookingSlot}
              >
                {isBookingSlot ? (
                  <ActivityIndicator color={theme.color.onPrimary} />
                ) : (
                  <Text style={styles.buttonText}>Book {formatDate(need.mealSlots.find((s) => s.id === selectedSlotId)!.date)}</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {canClaimGoods && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Claim this item</Text>
          <Text style={styles.hint}>
            Only claim if you actually have this item to give — claiming shares your contact
            details with the beneficiary so they can coordinate handover with you directly.
          </Text>
          <TouchableOpacity
            style={[styles.button, isClaiming && styles.buttonDisabled]}
            onPress={handleClaim}
            disabled={isClaiming}
          >
            {isClaiming ? <ActivityIndicator color={theme.color.onPrimary} /> : <Text style={styles.buttonText}>I have this</Text>}
          </TouchableOpacity>
        </View>
      )}
      {goods && hasClaimed && (
        <View style={styles.section}>
          <Text style={styles.hint}>
            Thanks — the beneficiary has your claim and can now see your contact details to
            coordinate handover.
          </Text>
        </View>
      )}

      {isOwner && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contributions awaiting your confirmation</Text>
          {pendingContributions.length === 0 && <Text style={styles.hint}>Nothing pending right now.</Text>}
          {pendingContributions.map((c) => (
            <View key={c.id} style={styles.contributionCard}>
              <Text style={styles.contributionAmount}>
                {formatContributionAmount(c)} · {c.donor.name ?? c.donor.phone}
              </Text>
              <Text style={styles.hint}>
                {c.utr ? `UTR: ${c.utr}` : c.kind === "BLOOD" ? "No payment — a donation pledge" : "No payment — delivery pledge"}
              </Text>
              <View style={styles.contributionActions}>
                <TouchableOpacity
                  style={styles.button}
                  onPress={() => handleDecision(c.id, "confirm")}
                  disabled={busyContributionId === c.id}
                >
                  <Text style={styles.buttonText}>Confirm</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dangerButton}
                  onPress={() => handleDecision(c.id, "reject")}
                  disabled={busyContributionId === c.id}
                >
                  <Text style={styles.dangerButtonText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.background },
  content: { padding: theme.spacing.lg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing.xl },
  backLink: { color: theme.color.primary, fontSize: 14, fontWeight: "600", marginBottom: theme.spacing.md },
  title: { fontSize: 22, fontWeight: "700", color: theme.color.textPrimary },
  status: { fontSize: 12, color: theme.color.textSecondary, marginTop: 2, marginBottom: theme.spacing.md },
  description: { fontSize: 15, color: theme.color.textPrimary, lineHeight: 22 },
  photoRow: { marginTop: theme.spacing.md },
  photo: { width: 140, height: 100, borderRadius: theme.radius, marginRight: theme.spacing.sm, backgroundColor: theme.color.border },
  rejection: { color: theme.color.danger, marginTop: theme.spacing.md, fontSize: 14 },
  section: {
    marginTop: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: theme.color.textPrimary, marginBottom: theme.spacing.md },
  bloodGroup: { fontSize: 16, fontWeight: "700", color: theme.color.danger, marginBottom: theme.spacing.sm },
  mealType: { fontSize: 16, fontWeight: "700", color: theme.color.primary, marginBottom: theme.spacing.sm, textTransform: "capitalize" },
  dateChipRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  dateChip: {
    borderWidth: 1,
    borderColor: theme.color.primary,
    borderRadius: 999,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
  },
  dateChipTaken: { borderColor: theme.color.border },
  dateChipSelected: { backgroundColor: theme.color.primary },
  dateChipText: { color: theme.color.primary, fontSize: 13, fontWeight: "600" },
  dateChipTextTaken: { color: theme.color.textSecondary },
  dateChipTextSelected: { color: theme.color.onPrimary },
  proofPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  proofPreview: { width: 56, height: 56, borderRadius: theme.radius, backgroundColor: theme.color.border },
  link: { color: theme.color.primary, fontSize: 14, fontWeight: "600" },
  input: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    fontSize: 16,
    color: theme.color.textPrimary,
    marginBottom: theme.spacing.md,
  },
  hint: { fontSize: 12, color: theme.color.textSecondary, marginBottom: theme.spacing.md },
  button: {
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: theme.color.onPrimary, fontSize: 15, fontWeight: "600" },
  secondaryButton: {
    borderWidth: 1,
    borderColor: theme.color.primary,
    borderRadius: theme.radius,
    paddingVertical: theme.spacing.md,
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  secondaryButtonText: { color: theme.color.primary, fontSize: 15, fontWeight: "600" },
  dangerButton: {
    borderWidth: 1,
    borderColor: theme.color.danger,
    borderRadius: theme.radius,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    alignItems: "center",
  },
  dangerButtonText: { color: theme.color.danger, fontSize: 15, fontWeight: "600" },
  errorText: { color: theme.color.danger, fontSize: 13, marginBottom: theme.spacing.md },
  contributionCard: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  contributionAmount: { fontSize: 14, fontWeight: "700", color: theme.color.textPrimary, marginBottom: 2 },
  contributionActions: { flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.sm },
});
