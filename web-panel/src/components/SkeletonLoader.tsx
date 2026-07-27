export function SkeletonBox({ height = 20, width = "100%", style }: { height?: number | string; width?: number | string; style?: React.CSSProperties }) {
  return <div className="shimmer-skeleton" style={{ height, width, ...style }} />;
}

export function CardSkeleton() {
  return (
    <div className="shimmer-card">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <SkeletonBox height={24} width="40%" />
        <SkeletonBox height={24} width="20%" />
      </div>
      <SkeletonBox height={16} width="85%" style={{ marginBottom: 8 }} />
      <SkeletonBox height={16} width="60%" style={{ marginBottom: 16 }} />
      <div style={{ display: "flex", gap: 10 }}>
        <SkeletonBox height={36} width="120px" />
        <SkeletonBox height={36} width="120px" />
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div style={{ padding: "20px 0" }}>
      <SkeletonBox height={32} width="260px" style={{ marginBottom: 16 }} />
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}
