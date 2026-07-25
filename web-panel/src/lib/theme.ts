// Same starting palette as mobile/src/lib/theme.ts (PRD Appendix A, D-014).
// TODO: extract into a shared @donationplatform/design-tokens package once
// mobile + web-panel + admin all need to stay in lockstep (D-014).
export const theme = {
  color: {
    primary: "#0E7C66",
    onPrimary: "#FFFFFF",
    accent: "#F2A900",
    success: "#2E9E5B",
    warning: "#C98A00",
    danger: "#D7263D",
    info: "#2B6CB0",
    background: "#F7F8F8",
    surface: "#FFFFFF",
    border: "#E2E5E4",
    textPrimary: "#14201D",
    textSecondary: "#5B6B67",
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: 12,
};
