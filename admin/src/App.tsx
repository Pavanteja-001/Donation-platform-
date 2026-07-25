import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { UsersPage } from "./pages/UsersPage";
import { StaffPage } from "./pages/StaffPage";
import { NeedsPage } from "./pages/NeedsPage";
import { NeedDetailRouteWrapper } from "./pages/NeedDetailRouteWrapper";
import { PostNeedPage } from "./pages/PostNeedPage";
import { InstitutionsPage } from "./pages/InstitutionsPage";
import { CreateMoneyNeedPage } from "./pages/CreateMoneyNeedPage";
import { CreateKitNeedPage } from "./pages/CreateKitNeedPage";
import { CreateBloodNeedPage } from "./pages/CreateBloodNeedPage";
import { CreateMealSlotNeedPage } from "./pages/CreateMealSlotNeedPage";
import { CreateGoodsNeedPage } from "./pages/CreateGoodsNeedPage";
import { ConsoleLayout } from "./components/ConsoleLayout";
import { ToastProvider } from "./components/ui";

function AdminRoute({ children }: { children: React.JSX.Element }) {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/needs" replace />;
}

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

function Root() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="loading">Loading…</div>;

  return (
    <Routes>
      <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/needs" replace />} />

      <Route element={user ? <ConsoleLayout /> : <Navigate to="/login" replace />}>
        <Route path="/" element={<Navigate to="/needs" replace />} />
        <Route path="/needs" element={<NeedsPage />} />
        <Route path="/needs/:needId" element={<NeedDetailRouteWrapper />} />
        <Route path="/institutions" element={<InstitutionsPage />} />
        <Route path="/users" element={<UsersPage />} />
        
        {/* Admin only routes */}
        <Route path="/post" element={<AdminRoute><PostNeedPage /></AdminRoute>} />
        <Route path="/post/money" element={<AdminRoute><CreateMoneyWrapper /></AdminRoute>} />
        <Route path="/post/kit" element={<AdminRoute><CreateKitWrapper /></AdminRoute>} />
        <Route path="/post/blood" element={<AdminRoute><CreateBloodWrapper /></AdminRoute>} />
        <Route path="/post/meal-slot" element={<AdminRoute><CreateMealSlotWrapper /></AdminRoute>} />
        <Route path="/post/goods" element={<AdminRoute><CreateGoodsWrapper /></AdminRoute>} />
        <Route path="/staff" element={<AdminRoute><StaffPage /></AdminRoute>} />
      </Route>

      <Route path="*" element={<Navigate to={user ? "/needs" : "/login"} replace />} />
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
