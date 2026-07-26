import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { postSkillRequestNeed } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { Button, Input, Card } from "../components/ui";

// PRD §13 — post a SKILL_REQUEST need. An admin verifies before it goes live.
export function CreateSkillRequestNeedScreen({ onDone }: { onDone: () => void }) {
  const { token } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [roleNeeded, setRoleNeeded] = useState("");
  const [volunteersNeeded, setVolunteersNeeded] = useState("1");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!token) return;
    if (!title.trim() || !description.trim()) return setError("Title and description are required");
    if (!roleNeeded.trim()) return setError("Describe the role or skill you need");
    const numVolunteers = parseInt(volunteersNeeded, 10);
    if (isNaN(numVolunteers) || numVolunteers < 1) return setError("Enter a valid number of volunteers needed");
    if (!date.trim()) return setError("Enter the date (YYYY-MM-DD)");
    if (!time.trim()) return setError("Enter the time (HH:MM)");

    setError(null);
    setIsSubmitting(true);
    try {
      await postSkillRequestNeed(token, {
        title: title.trim(),
        description: description.trim(),
        role_needed: roleNeeded.trim(),
        volunteers_needed: numVolunteers,
        date: date.trim(),
        time: time.trim(),
        city: city.trim() || undefined,
        area: area.trim() || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post this need");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Animated.View entering={FadeInDown.delay(100).duration(500)}>
        <Card elevated style={styles.card}>
          <Text style={styles.heading}>Post a Volunteering Need</Text>
          <Text style={styles.hint}>An admin verifies every volunteer request before it goes live.</Text>

          <Input
            label="Title"
            placeholder="E.g., Volunteers needed for blood camp"
            value={title}
            onChangeText={(txt) => { setTitle(txt); setError(null); }}
          />
          <Input
            label="Description"
            placeholder="Describe the need in detail…"
            value={description}
            onChangeText={(txt) => { setDescription(txt); setError(null); }}
            multiline
          />
          <Input
            label="Role / Skill Needed"
            placeholder="E.g., Medical volunteer, Driver, Organiser"
            value={roleNeeded}
            onChangeText={(txt) => { setRoleNeeded(txt); setError(null); }}
          />
          <Input
            label="Number of Volunteers"
            placeholder="1"
            value={volunteersNeeded}
            onChangeText={(txt) => { setVolunteersNeeded(txt); setError(null); }}
            keyboardType="number-pad"
          />
          <Input
            label="Date (YYYY-MM-DD)"
            placeholder="2024-12-31"
            value={date}
            onChangeText={(txt) => { setDate(txt); setError(null); }}
            keyboardType="numbers-and-punctuation"
          />
          <Input
            label="Time (HH:MM)"
            placeholder="09:00"
            value={time}
            onChangeText={(txt) => { setTime(txt); setError(null); }}
          />
          <Input
            label="City (optional)"
            placeholder="Hyderabad"
            value={city}
            onChangeText={setCity}
          />
          <Input
            label="Area (optional)"
            placeholder="Gachibowli"
            value={area}
            onChangeText={setArea}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.buttonWrap}>
            <Button
              label={isSubmitting ? "Submitting…" : "Post Volunteering Need"}
              onPress={handleSubmit}
              disabled={isSubmitting}
            />
          </View>
        </Card>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.background },
  content: { padding: theme.spacing.lg },
  card: { padding: theme.spacing.lg },
  heading: { fontSize: 18, fontWeight: "700", color: theme.color.textPrimary, marginBottom: theme.spacing.xs },
  hint: { fontSize: 13, color: theme.color.textSecondary, marginBottom: theme.spacing.lg },
  error: { color: theme.color.danger, fontSize: 13, marginBottom: theme.spacing.md },
  buttonWrap: { marginTop: theme.spacing.md },
});
