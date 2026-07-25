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
import * as ImagePicker from "expo-image-picker";
import {
  confirmContribution,
  donate,
  fetchContributions,
  fetchNeed,
  rejectContribution,
  signUpload,
  uploadToSignedUrl,
  type Contribution,
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

const FUNDABLE: Need["status"][] = ["LIVE", "PARTIALLY_FULFILLED"];

export function NeedDetailScreen({ needId, onBack }: { needId: string; onBack: () => void }) {
  const { token, user } = useAuth();
  const [need, setNeed] = useState<Need | null>(null);
  const [contributions, setContributions] = useState<Contribution[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [utr, setUtr] = useState("");
  const [proofImage, setProofImage] = useState<{ uri: string; mimeType: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyContributionId, setBusyContributionId] = useState<string | null>(null);

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

      {money && (
        <View style={styles.section}>
          <ProgressBar raised={money.raised_amount} target={money.target_amount} />
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

      {isOwner && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contributions awaiting your confirmation</Text>
          {pendingContributions.length === 0 && <Text style={styles.hint}>Nothing pending right now.</Text>}
          {pendingContributions.map((c) => (
            <View key={c.id} style={styles.contributionCard}>
              <Text style={styles.contributionAmount}>
                ₹{c.amount.toLocaleString("en-IN")} · {c.donor.name ?? c.donor.phone}
              </Text>
              <Text style={styles.hint}>UTR: {c.utr}</Text>
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
  rejection: { color: theme.color.danger, marginTop: theme.spacing.md, fontSize: 14 },
  section: {
    marginTop: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: theme.color.textPrimary, marginBottom: theme.spacing.md },
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
