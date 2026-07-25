import { useParams, useNavigate } from "react-router-dom";
import { NeedDetailPage } from "./NeedDetailPage";

export function NeedDetailRouteWrapper() {
  const { needId } = useParams<{ needId: string }>();
  const navigate = useNavigate();

  if (!needId) return null;

  return (
    <NeedDetailPage
      needId={needId}
      onBack={() => navigate("/needs")}
    />
  );
}
