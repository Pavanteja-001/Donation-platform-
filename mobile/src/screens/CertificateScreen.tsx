import { useEffect, useState } from "react";
import { Alert, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { fetchCertificate, type Certificate } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { TYPE_META } from "../lib/needMeta";
import { Button, ErrorState, Skeleton } from "../components/ui";
import { Gradient } from "../components/Gradient";

function CertificateSkeleton() {
  return (
    <View style={[styles.card, styles.skeletonCard]}>
      <Skeleton width={84} height={84} radius={42} />
      <Skeleton width="55%" height={14} style={{ marginTop: theme.spacing.lg }} />
      <Skeleton width="80%" height={24} style={{ marginTop: theme.spacing.sm }} />
      <Skeleton width="100%" height={1} style={{ marginTop: theme.spacing.xl }} />
      <Skeleton width="70%" height={16} style={{ marginTop: theme.spacing.xl }} />
      <Skeleton width="50%" height={22} style={{ marginTop: theme.spacing.md }} />
      <Skeleton width="85%" height={16} style={{ marginTop: theme.spacing.md }} />
    </View>
  );
}

// PRD §14.2 — certificate view. The disclaimer (D-006) is always shown: this is a platform
// record and a thank-you, never an official, medical or government document.
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
      await Share.share({ message, title: "Certificate of Contribution" });
    } catch (err) {
      Alert.alert("Error", "Could not share certificate");
    } finally {
      setIsSharing(false);
    }
  };

  if (error) {
    return (
      <View style={styles.centered}>
        <ErrorState message={error} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {!certificate ? (
        <CertificateSkeleton />
      ) : (
        <>
          <Animated.View entering={FadeInDown.duration(420)}>
            <View style={[styles.card, theme.elevation.level3]}>
              {/* Double-ruled frame — the visual language of a certificate, done with borders
                  rather than an image so it stays crisp at any density. */}
              <View style={styles.innerFrame}>
                <View style={styles.seal}>
                  <Gradient
                    colors={theme.gradient.gold}
                    direction="diagonal"
                    style={StyleSheet.absoluteFill as never}
                    pointerEvents="none"
                  />
                  {/* Specular arc across the lit half — a flat gold circle still reads as a
                      sticker; the highlight is what makes it read as pressed metal. */}
                  <Gradient
                    colors={["rgba(255,255,255,0.6)", "rgba(255,255,255,0)"]}
                    angle={{ start: { x: 0.15, y: 0 }, end: { x: 0.6, y: 0.8 } }}
                    style={StyleSheet.absoluteFill as never}
                    pointerEvents="none"
                  />
                  <Feather name="award" size={34} color="#5C3714" />
                </View>

                <Text style={styles.eyebrow}>DonationPlatform</Text>
                <Text style={styles.title}>Certificate of Contribution</Text>

                <View style={styles.rule} />

                <Text style={styles.presentedTo}>This certifies that</Text>
                <Text style={styles.donorName}>{certificate.donorName}</Text>
                <Text style={styles.presentedTo}>has generously contributed</Text>
                <Text style={styles.summary}>{certificate.summary}</Text>
                <Text style={styles.presentedTo}>toward</Text>
                <Text style={styles.needTitle}>“{certificate.needTitle}”</Text>

                <View style={styles.typeChip}>
                  <Feather
                    name={TYPE_META[certificate.needType].icon}
                    size={12}
                    color={TYPE_META[certificate.needType].color}
                  />
                  <Text style={[styles.typeChipText, { color: TYPE_META[certificate.needType].color }]}>
                    {TYPE_META[certificate.needType].label}
                  </Text>
                </View>

                <View style={styles.rule} />

                <View style={styles.footerRow}>
                  <View style={styles.footerItem}>
                    <Text style={styles.footerLabel}>Confirmed</Text>
                    <Text style={styles.footerValue}>
                      {new Date(certificate.confirmedAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </Text>
                  </View>
                  <View style={styles.footerDivider} />
                  <View style={styles.footerItem}>
                    <Text style={styles.footerLabel}>Verification ID</Text>
                    <Text style={styles.footerId} numberOfLines={1}>
                      {certificate.certificateId}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* D-006 — deliberately outside the certificate frame. Inside it, a disclaimer starts to
              look like part of the credential; outside, it reads as what it is. */}
          <Animated.View entering={FadeInDown.delay(120).duration(360)} style={styles.disclaimerBox}>
            <Feather name="info" size={15} color={theme.color.textSecondary} />
            <Text style={styles.disclaimerText}>{certificate.disclaimer}</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(180).duration(360)} style={styles.actions}>
            <Button label="Share certificate" icon="share-2" size="lg" glow onPress={handleShare} loading={isSharing} />
          </Animated.View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.background },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxxl, gap: theme.spacing.md },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing.xl, backgroundColor: theme.color.background },

  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radii.xxl,
    padding: theme.spacing.sm,
  },
  skeletonCard: { alignItems: "center", padding: theme.spacing.xxl },
  innerFrame: {
    borderWidth: 1,
    borderColor: theme.color.primary,
    borderRadius: theme.radii.xl,
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.xl,
    alignItems: "center",
  },

  seal: {
    width: 76,
    height: 76,
    borderRadius: 38,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#B8860B",
    shadowColor: "#7A4E12",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 7,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.lg,
  },
  eyebrow: { ...theme.typography.overline, color: theme.color.primary, letterSpacing: 1.6, textTransform: "uppercase" },
  title: { ...theme.typography.h2, color: theme.color.textPrimary, marginTop: theme.spacing.xs, textAlign: "center" },

  rule: { width: "55%", height: 1, backgroundColor: theme.color.border, marginVertical: theme.spacing.xl },

  presentedTo: { ...theme.typography.bodySmall, color: theme.color.textSecondary, textAlign: "center" },
  donorName: {
    ...theme.typography.h1,
    color: theme.color.textPrimary,
    textAlign: "center",
    marginVertical: theme.spacing.sm,
  },
  summary: {
    ...theme.typography.numeric,
    color: theme.color.primary,
    textAlign: "center",
    marginVertical: theme.spacing.sm,
  },
  needTitle: {
    ...theme.typography.h3,
    color: theme.color.textPrimary,
    textAlign: "center",
    marginTop: theme.spacing.sm,
  },

  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: theme.color.surfaceMuted,
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    marginTop: theme.spacing.lg,
  },
  typeChipText: { ...theme.typography.overline, textTransform: "uppercase" },

  footerRow: { flexDirection: "row", alignItems: "center", alignSelf: "stretch" },
  footerItem: { flex: 1, alignItems: "center", gap: 3 },
  footerDivider: { width: 1, height: 32, backgroundColor: theme.color.borderSubtle },
  footerLabel: { ...theme.typography.overline, color: theme.color.textTertiary, textTransform: "uppercase" },
  footerValue: { ...theme.typography.caption, color: theme.color.textPrimary, fontWeight: "700", textAlign: "center" },
  footerId: { ...theme.typography.caption, color: theme.color.textSecondary, fontWeight: "600" },

  disclaimerBox: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    alignItems: "flex-start",
    backgroundColor: theme.color.surfaceMuted,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
  },
  disclaimerText: { ...theme.typography.caption, color: theme.color.textSecondary, flex: 1, lineHeight: 17 },

  actions: { marginTop: theme.spacing.xs },
});
