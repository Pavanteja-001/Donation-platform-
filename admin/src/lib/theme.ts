// Same starting palette as mobile/web-panel (PRD Appendix A, D-014). No monorepo/shared-package
// tooling exists yet, so each app keeps its own copy — kept in sync by hand. This file was
// previously missing success/warning/info and the spacing scale entirely (real drift from the
// other two apps' theme.ts, caught during the Chunk 1 design-system pass); fixed here.
export const theme = {
  color: {
    primary: "#0e7c66",
    onPrimary: "#ffffff",
    accent: "#f2a900",
    success: "#2e9e5b",
    warning: "#c98a00",
    danger: "#d7263d",
    info: "#2b6cb0",
    background: "#f7f8f8",
    surface: "#ffffff",
    border: "#e2e5e4",
    textPrimary: "#14201d",
    textSecondary: "#5b6b67",
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: 12,
};
