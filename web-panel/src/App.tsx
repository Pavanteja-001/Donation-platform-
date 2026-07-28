import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { DashboardLayout } from "./components/DashboardLayout";
import { DashboardOverviewPage } from "./pages/DashboardOverviewPage";
import { MyNeedsPage } from "./pages/MyNeedsPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { OrphanageProfilePage } from "./pages/OrphanageProfilePage";
import { BookingsPage } from "./pages/BookingsPage";
import { NeedDetailRouteWrapper } from "./pages/NeedDetailRouteWrapper";
import { PostNeedPage } from "./pages/PostNeedPage";
import { CreateMoneyNeedPage } from "./pages/CreateMoneyNeedPage";
import { CreateKitNeedPage } from "./pages/CreateKitNeedPage";
import { CreateBloodNeedPage } from "./pages/CreateBloodNeedPage";
import { CreateMealSlotNeedPage } from "./pages/CreateMealSlotNeedPage";
import { CreateGoodsNeedPage } from "./pages/CreateGoodsNeedPage";
import { CreateSkillRequestNeedPage } from "./pages/CreateSkillRequestNeedPage";
import { VerificationStatusPage } from "./pages/VerificationStatusPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ToastProvider } from "./components/ui";

function CreateMoneyWrapper() {
  const navigate = useNavigate();
  return <CreateMoneyNeedPage onBack={() => navigate("/post")} onDone={() => navigate("/needs")} />;
}

function CreateKitWrapper() {
  const navigate = useNavigate();
  return <CreateKitNeedPage onBack={() => navigate("/post")} onDone={() => navigate("/needs")} />;
}

function CreateBloodWrapper() {
  const navigate = useNavigate();
  return <CreateBloodNeedPage onBack={() => navigate("/post")} onDone={() => navigate("/needs")} />;
}

function CreateMealSlotWrapper() {
  const navigate = useNavigate();
  return <CreateMealSlotNeedPage onBack={() => navigate("/post")} onDone={() => navigate("/needs")} />;
}

function CreateGoodsWrapper() {
  const navigate = useNavigate();
  return <CreateGoodsNeedPage onBack={() => navigate("/post")} onDone={() => navigate("/needs")} />;
}

function CreateSkillRequestWrapper() {
  const navigate = useNavigate();
  return <CreateSkillRequestNeedPage onBack={() => navigate("/post")} onDone={() => navigate("/needs")} />;
}

function Root() {
  const { user, isLoading } = useAuth();
  const isInstitution = !!user && user.role === "INSTITUTION";

  if (isLoading) return <div className="loading">Loading…</div>;

  return (
    <Routes>
      <Route path="/login" element={!isInstitution ? <LoginPage /> : <Navigate to="/dashboard" replace />} />
      
      <Route element={isInstitution ? <DashboardLayout /> : <Navigate to="/login" replace />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardOverviewPage />} />
        <Route path="/needs" element={<MyNeedsPage />} />
        <Route path="/needs/:needId" element={<NeedDetailRouteWrapper />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/home-profile" element={<OrphanageProfilePage />} />
        <Route path="/bookings" element={<BookingsPage />} />
        <Route path="/post" element={<PostNeedPage />} />
        <Route path="/post/money" element={<CreateMoneyWrapper />} />
        <Route path="/post/kit" element={<CreateKitWrapper />} />
        <Route path="/post/blood" element={<CreateBloodWrapper />} />
        <Route path="/post/meal-slot" element={<CreateMealSlotWrapper />} />
        <Route path="/post/goods" element={<CreateGoodsWrapper />} />
        <Route path="/post/skill-request" element={<CreateSkillRequestWrapper />} />
        <Route path="/verification" element={<VerificationStatusPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to={isInstitution ? "/dashboard" : "/login"} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Root />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
