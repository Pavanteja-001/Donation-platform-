import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { fetchCertificate, type Certificate } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { Card, Button, ErrorState } from "../components/ui";

// PRD §14.2 — certificate view. Disclaimer (D-006) is always shown.
// Overhauled with premium styling and animated entrance.
export function CertificateScreen({ contributionId }: { contributionId: string }) {
  const { token } = useAuth();
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchCertificate(token, contributionId)
      .then(({ certificate }) => setCertificate(certificate))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load this certificate"));
  }, [token, contributionId]);

  const handleShare = async () => {
    if (!certificate) return;
    setIsSharing(true);
    try {
      const message = `I contributed ${certificate.summary} toward "${certificate.needTitle}" on DonationPlatform! Check it out.`;
      await Share.share({
        message,
        title: "Certificate of Contribution",
      });
    } catch (err) {
      Alert.alert("Error", "Could not share certificate");
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {error && (
        <View style={styles.centered}>
          <ErrorState message={error} />
        </View>
      )}
      
      {!certificate && !error && (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.color.primary} size="large" />
        </View>
      )}

      {certificate && (
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <Card elevated style={styles.card}>
            <View style={styles.sealCircle}>
              <Feather name="award" size={36} color={theme.color.primary} />
            </View>

            <Text style={styles.eyebrow}>DonationPlatform</Text>
            <Text style={styles.title}>Certificate of Contribution</Text>
            
            <View style={styles.divider} />

            <Text style={styles.body}>
              This certifies that{"\n"}
              <Text style={styles.bold}>{certificate.donorName}</Text>{"\n"}
              has generously contributed{"\n"}
              <Text style={styles.amountText}>{certificate.summary}</Text>{"\n"}
              toward{"\n"}
              <Text style={styles.bold}>"{certificate.needTitle}"</Text>{"\n"}
              ({certificate.needType.replace("_", " ")}).
            </Text>

            <View style={styles.divider} />

            <Text style={styles.date}>Confirmed {new Date(certificate.confirmedAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}</Text>
            <Text style={styles.refId}>Verification ID: {certificate.certificateId}</Text>

            <View style={styles.disclaimerBox}>
              <Feather name="info" size={14} color={theme.color.textSecondary} style={{ marginRight: 6, marginTop: 1 }} />
              <Text style={styles.disclaimerText}>{certificate.disclaimer}</Text>
            </View>
          </Card>

          <View style={styles.actionsContainer}>
            <Button
              label="Share Certificate"
              onPress={handleShare}
              variant="primary"
              loading={isSharing}
            />
          </View>
        </Animated.View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.background },
  content: { padding: theme.spacing.lg, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 80 },
  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 2,
    borderColor: theme.color.primary,
    borderRadius: theme.radius * 1.5,
    padding: theme.spacing.xl,
    alignItems: "center",
  },
  sealCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.color.primary + "12",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.md,
  },
  eyebrow: { fontSize: 12, fontWeight: "700", color: theme.color.primary, letterSpacing: 1.5, textTransform: "uppercase" },
  title: { fontSize: 22, fontWeight: "700", color: theme.color.textPrimary, marginTop: 4, textAlign: "center" },
  divider: {
    width: "60%",
    height: 1,
    backgroundColor: theme.color.border,
    marginVertical: theme.spacing.lg,
  },
  body: { fontSize: 15, color: theme.color.textPrimary, lineHeight: 28, textAlign: "center" },
  bold: { fontWeight: "700", color: theme.color.textPrimary, fontSize: 16 },
  amountText: { fontSize: 18, fontWeight: "700", color: theme.color.primary },
  date: { fontSize: 13, color: theme.color.textSecondary, fontWeight: "600" },
  refId: { fontSize: 11, color: theme.color.textSecondary, marginTop: 2, fontWeight: "500" },
  disclaimerBox: {
    marginTop: theme.spacing.xl,
    padding: theme.spacing.md,
    backgroundColor: theme.color.background,
    borderRadius: theme.radius,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  disclaimerText: { flex: 1, fontSize: 11, color: theme.color.textSecondary, lineHeight: 16 },
  actionsContainer: { marginTop: theme.spacing.xl },
});
