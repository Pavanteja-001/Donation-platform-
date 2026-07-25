import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function DashboardLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    signOut();
    navigate("/login");
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1>DonationPlatform</h1>
          <p className="subtitle">Institution Panel</p>
        </div>

        <nav className="sidebar-nav">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => (isActive ? "sidebar-nav-link active" : "sidebar-nav-link")}
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/needs"
            className={({ isActive }) => (isActive ? "sidebar-nav-link active" : "sidebar-nav-link")}
          >
            My Needs
          </NavLink>
          <NavLink
            to="/post"
            className={({ isActive }) => (isActive ? "sidebar-nav-link active" : "sidebar-nav-link")}
          >
            Post a Need
          </NavLink>
          <NavLink
            to="/verification"
            className={({ isActive }) => (isActive ? "sidebar-nav-link active" : "sidebar-nav-link")}
          >
            Verification Status
          </NavLink>
          <NavLink
            to="/profile"
            className={({ isActive }) => (isActive ? "sidebar-nav-link active" : "sidebar-nav-link")}
          >
            Profile
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <p className="user-name">{user?.name ?? "Institution"}</p>
          <p className="user-phone">{user?.phone}</p>
          <button type="button" className="link" onClick={handleSignOut}>
            Log out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
