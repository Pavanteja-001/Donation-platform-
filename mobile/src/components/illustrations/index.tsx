import Svg, { Defs, Ellipse, G, LinearGradient, Path, Rect, Stop, Circle } from "react-native-svg";

/**
 * Dimensional vector illustrations, used where flat glyph icons read as cheap.
 *
 * These are NOT 3D renders. A real 3D model means either shipping raster art (which can't
 * recolour, costs bundle size, and needs a designer per state) or running react-three-fiber at
 * runtime (needs expo-gl, and burns frame rate inside a scrolling FlashList on low-end Android —
 * exactly the phones this app targets). Vector shading gets most of the look for almost nothing:
 * they scale to any size, tint from theme tokens, and cost one SVG node tree.
 *
 * The dimensional read comes from the same light model as the rest of the app — **lit from the
 * top-left**: a light face on the upper-left, the body colour in the middle, a shaded face on
 * the lower-right, plus a specular highlight and a contact shadow underneath.
 */

/** Shared ground shadow — what actually makes an object look like it's sitting on the surface. */
function ContactShadow({ cx, cy, rx, ry = 3.5 }: { cx: number; cy: number; rx: number; ry?: number }) {
  return <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="rgba(40,10,12,0.18)" />;
}

/**
 * Blood bag with tubing — the flagship illustration for BLOOD needs.
 * `fillLevel` (0–1) drives how full the bag reads, so a card can show real progress.
 */
export function BloodBagIllustration({ size = 64, fillLevel = 0.72 }: { size?: number; fillLevel?: number }) {
  const level = Math.max(0, Math.min(1, fillLevel));
  // Bag interior spans y=16→56; fill rises from the bottom.
  const fillTop = 56 - 40 * level;

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id="bagBody" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
          <Stop offset="0.5" stopColor="#F3DDDF" stopOpacity="0.9" />
          <Stop offset="1" stopColor="#D9B9BD" stopOpacity="0.95" />
        </LinearGradient>
        <LinearGradient id="bloodFill" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#E23B3B" />
          <Stop offset="0.55" stopColor="#B91C1C" />
          <Stop offset="1" stopColor="#6E0F0F" />
        </LinearGradient>
        <LinearGradient id="tube" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#F0DADC" />
          <Stop offset="1" stopColor="#C8A6AA" />
        </LinearGradient>
      </Defs>

      <ContactShadow cx={32} cy={59} rx={17} />

      {/* Hanger loop */}
      <Path d="M28 8 h8 v4 h-8 z" fill="url(#tube)" />
      <Circle cx={32} cy={7} r={3.2} fill="none" stroke="#C8A6AA" strokeWidth={2} />

      {/* Bag body */}
      <Rect x={14} y={12} width={36} height={44} rx={9} fill="url(#bagBody)" />

      {/* Blood level, clipped by the bag's rounded shape via a matching rect */}
      <G>
        <Rect x={16} y={fillTop} width={32} height={56 - fillTop} rx={7} fill="url(#bloodFill)" />
        {/* Meniscus — the lighter surface line reads as liquid rather than a filled block */}
        <Rect x={16} y={fillTop} width={32} height={2} fill="rgba(255,255,255,0.35)" />
      </G>

      {/* Specular highlight down the lit edge */}
      <Path d="M20 18 q3 -3 6 -2 v30 q-3 1 -6 -1 z" fill="rgba(255,255,255,0.45)" />

      {/* Outlet tube */}
      <Path d="M32 56 v5 q0 3 4 3" stroke="url(#tube)" strokeWidth={3} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/** Curated kit box — KIT and GOODS needs. An open carton with contents, not a sealed cube. */
export function KitBoxIllustration({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id="boxFront" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#D9A56B" />
          <Stop offset="1" stopColor="#A9743E" />
        </LinearGradient>
        <LinearGradient id="boxLid" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F0C48E" />
          <Stop offset="1" stopColor="#C2915A" />
        </LinearGradient>
        <LinearGradient id="boxSide" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#8E5F32" />
          <Stop offset="1" stopColor="#6F4826" />
        </LinearGradient>
      </Defs>

      <ContactShadow cx={32} cy={57} rx={19} />

      {/* Contents peeking above the rim — what makes it read as a *kit*, not an empty box */}
      <Rect x={22} y={18} width={9} height={14} rx={2} fill="#E8A317" />
      <Rect x={32} y={14} width={8} height={18} rx={2} fill="#0E9F6E" />
      <Circle cx={26} cy={17} r={4} fill="#B91C1C" />

      {/* Box body: lit front face, shaded right face */}
      <Path d="M12 28 h30 v22 l-30 4 z" fill="url(#boxFront)" />
      <Path d="M42 28 h10 v18 l-10 6 z" fill="url(#boxSide)" />
      {/* Open flaps */}
      <Path d="M12 28 l8 -6 h30 l-8 6 z" fill="url(#boxLid)" />
      <Path d="M42 28 l8 -6 h2 v6 z" fill="#B98753" />

      {/* Tape highlight along the lit top edge */}
      <Path d="M12 28 h30 v2 h-30 z" fill="rgba(255,255,255,0.25)" />
    </Svg>
  );
}

/** Rupee coin stack — MONEY needs and the "raised" stat. */
export function RupeeStackIllustration({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id="coinFace" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F7DFA0" />
          <Stop offset="0.5" stopColor="#D9A441" />
          <Stop offset="1" stopColor="#9C6B1E" />
        </LinearGradient>
        <LinearGradient id="coinEdge" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#C9922F" />
          <Stop offset="1" stopColor="#8A5C18" />
        </LinearGradient>
      </Defs>

      <ContactShadow cx={32} cy={55} rx={18} />

      {/* Stack, back to front so each coin's edge shows */}
      {[44, 38, 32].map((y, i) => (
        <G key={y}>
          <Ellipse cx={32} cy={y + 4} rx={17} ry={6} fill="url(#coinEdge)" />
          <Rect x={15} y={y} width={34} height={4} fill="url(#coinEdge)" />
          <Ellipse cx={32} cy={y} rx={17} ry={6} fill="url(#coinFace)" />
          {i === 2 && (
            <>
              {/* ₹ mark on the top coin only */}
              <Path
                d="M27 -3 h10 M27 0 h10 M35 -3 q-8 0 -8 3 q0 3 8 3 l-6 4"
                transform={`translate(0 ${y})`}
                stroke="#7A4E12"
                strokeWidth={1.6}
                fill="none"
                strokeLinecap="round"
              />
            </>
          )}
        </G>
      ))}
    </Svg>
  );
}

/** Donor community — the "live needs" stat. Overlapping figures, lit from the top-left. */
export function DonorsIllustration({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id="figFront" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#E4D2D4" />
        </LinearGradient>
        <LinearGradient id="figBack" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#E9C9CB" />
          <Stop offset="1" stopColor="#B58F93" />
        </LinearGradient>
      </Defs>

      <ContactShadow cx={32} cy={55} rx={18} />

      <G opacity={0.9}>
        <Circle cx={18} cy={26} r={8} fill="url(#figBack)" />
        <Path d="M6 52 q0 -13 12 -13 q12 0 12 13 z" fill="url(#figBack)" />
      </G>
      <G opacity={0.9}>
        <Circle cx={46} cy={26} r={8} fill="url(#figBack)" />
        <Path d="M34 52 q0 -13 12 -13 q12 0 12 13 z" fill="url(#figBack)" />
      </G>
      <G>
        <Circle cx={32} cy={22} r={10} fill="url(#figFront)" />
        <Path d="M17 54 q0 -16 15 -16 q15 0 15 16 z" fill="url(#figFront)" />
      </G>
    </Svg>
  );
}

/**
 * Trust-tier shield.
 *
 * Metal is read from three cues, none of which a flat badge has: a diagonal gradient across the
 * face, a bright bevel down the lit edge with a dark one opposite, and a hard specular streak.
 * Bronze/silver/gold differ only in the ramp, so tiers stay visually a family.
 */
export function TierEmblem({ tier, size = 56 }: { tier: "BRONZE" | "SILVER" | "GOLD"; size?: number }) {
  const ramp =
    tier === "GOLD"
      ? { light: "#F7DFA0", mid: "#D9A441", dark: "#8A5C18", star: "#7A4E12" }
      : tier === "SILVER"
        ? { light: "#FFFFFF", mid: "#C9CDD4", dark: "#7E838B", star: "#6B7078" }
        : { light: "#E8B98D", mid: "#B87333", dark: "#6E4218", star: "#5C3714" };

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id={`shield-${tier}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={ramp.light} />
          <Stop offset="0.45" stopColor={ramp.mid} />
          <Stop offset="1" stopColor={ramp.dark} />
        </LinearGradient>
        <LinearGradient id={`bevel-${tier}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="rgba(255,255,255,0.85)" />
          <Stop offset="0.5" stopColor="rgba(255,255,255,0.1)" />
          <Stop offset="1" stopColor="rgba(0,0,0,0.35)" />
        </LinearGradient>
      </Defs>

      <ContactShadow cx={32} cy={58} rx={15} ry={3} />

      {/* Outer bevel, then the face inset inside it — that 2px offset is the whole illusion */}
      <Path d="M32 4 L56 13 v20 q0 17 -24 27 Q8 50 8 33 V13 z" fill={`url(#bevel-${tier})`} />
      <Path d="M32 7 L53 15 v18 q0 15 -21 24 Q11 48 11 33 V15 z" fill={`url(#shield-${tier})`} />

      {/* Specular streak across the lit shoulder */}
      <Path d="M16 17 L30 11 L24 30 L14 27 z" fill="rgba(255,255,255,0.30)" />

      {/* Star: the tier mark itself */}
      <Path
        d="M32 21 l3.4 7 7.6 1 -5.5 5.3 1.3 7.5 -6.8 -3.6 -6.8 3.6 1.3 -7.5 -5.5 -5.3 7.6 -1 z"
        fill={ramp.star}
        opacity={0.85}
      />
      <Path
        d="M32 23 l2.8 5.8 6.3 0.8 -4.6 4.4 1.1 6.2 -5.6 -3 -5.6 3 1.1 -6.2 -4.6 -4.4 6.3 -0.8 z"
        fill="rgba(255,255,255,0.55)"
      />
    </Svg>
  );
}

/** Pulsing alert marker — the "needs help now" stat and emergency surfaces. */
export function UrgentPulseIllustration({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id="alertBody" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FF8A8A" />
          <Stop offset="0.5" stopColor="#EF4444" />
          <Stop offset="1" stopColor="#991B1B" />
        </LinearGradient>
      </Defs>

      <Circle cx={32} cy={32} r={26} fill="rgba(239,68,68,0.14)" />
      <Circle cx={32} cy={32} r={19} fill="rgba(239,68,68,0.20)" />
      <Circle cx={32} cy={32} r={14} fill="url(#alertBody)" />
      {/* Exclamation, drawn rather than typed so it scales with the mark */}
      <Rect x={30} y={24} width={4} height={11} rx={2} fill="#FFFFFF" />
      <Circle cx={32} cy={39} r={2.4} fill="#FFFFFF" />
      {/* Specular */}
      <Path d="M24 24 q4 -5 9 -4 q-6 2 -7 7 z" fill="rgba(255,255,255,0.4)" />
    </Svg>
  );
}
