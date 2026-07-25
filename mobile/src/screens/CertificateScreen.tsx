import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { fetchCertificate, type Certificate } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";

// PRD §14.2 — a derived view over a confirmed contribution. The disclaimer (D-006) is always
// shown, same weight as the rest of the certificate — never a fine-print afterthought, since the
// whole point is not letting this be mistaken for an official document.
export function CertificateScreen({ contributionId, onBack }: { contributionId: string; onBack: () => void }) {
  const { token } = useAuth();
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchCertificate(token, contributionId)
      .then(({ certificate }) => setCertificate(certificate))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load this certificate"));
  }, [token, contributionId]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backLink}>‹ Back</Text>
      </TouchableOpacity>

      {error && <Text style={styles.errorText}>{error}</Text>}
      {!certificate && !error && (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.color.primary} />
        </View>
      )}

      {certificate && (
        <View style={styles.card}>
          <Text style={styles.eyebrow}>DonationPlatform</Text>
          <Text style={styles.title}>Certificate of Contribution</Text>
          <Text style={styles.body}>
            This certifies that <Text style={styles.bold}>{certificate.donorName}</Text> contributed{" "}
            <Text style={styles.bold}>{certificate.summary}</Text> toward{" "}
            <Text style={styles.bold}>"{certificate.needTitle}"</Text> ({certificate.needType.replace("_", " ")}).
          </Text>
          <Text style={styles.date}>Confirmed {new Date(certificate.confirmedAt).toLocaleDateString()}</Text>
          <Text style={styles.refId}>Reference: {certificate.certificateId}</Text>

          <View style={styles.disclaimerBox}>
            <Text style={styles.disclaimerText}>{certificate.disclaimer}</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.background },
  content: { padding: theme.spacing.lg },
  centered: { alignItems: "center", justifyContent: "center", padding: theme.spacing.xl },
  backLink: { color: theme.color.primary, fontSize: 14, fontWeight: "600", marginBottom: theme.spacing.md },
  errorText: { color: theme.color.danger, fontSize: 14 },
  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.primary,
    borderRadius: theme.radius,
    padding: theme.spacing.xl,
    alignItems: "center",
  },
  eyebrow: { fontSize: 12, fontWeight: "700", color: theme.color.primary, letterSpacing: 1, textTransform: "uppercase" },
  title: { fontSize: 20, fontWeight: "700", color: theme.color.textPrimary, marginTop: 4, marginBottom: theme.spacing.lg, textAlign: "center" },
  body: { fontSize: 15, color: theme.color.textPrimary, lineHeight: 22, textAlign: "center" },
  bold: { fontWeight: "700" },
  date: { fontSize: 13, color: theme.color.textSecondary, marginTop: theme.spacing.lg },
  refId: { fontSize: 11, color: theme.color.textSecondary, marginTop: 2 },
  disclaimerBox: {
    marginTop: theme.spacing.xl,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
  disclaimerText: { fontSize: 12, color: theme.color.textSecondary, textAlign: "center", lineHeight: 17 },
});
