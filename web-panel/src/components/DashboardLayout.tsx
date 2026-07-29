import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchUnreadCount } from "../lib/api";

function useUnreadCount(token: string | null) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!token) return;
    let alive = true;
    const poll = () =>
      fetchUnreadCount(token)
        .then(({ unreadCount }) => alive && setUnread(unreadCount))
        .catch(() => {});
    poll();
    const timer = setInterval(poll, 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [token]);
  return unread;
}

export function DashboardLayout() {
  const { user, signOut, token } = useAuth();
  const unread = useUnreadCount(token);
  const isOrphanage = user?.institutionType === "ORPHANAGE";
  const isNgo = user?.institutionType === "NGO";
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

          {/* Volunteering is an NGO concern; meal sponsorship is an orphanage one. Each set of
              links is hidden for the other type rather than leading to a "not for you" page. */}
          {isNgo && (
            <NavLink
              to="/volunteers"
              className={({ isActive }) => (isActive ? "sidebar-nav-link active" : "sidebar-nav-link")}
            >
              Volunteers &amp; Team
            </NavLink>
          )}

          {isOrphanage && (
            <>
              <NavLink
                to="/bookings"
                className={({ isActive }) => (isActive ? "sidebar-nav-link active" : "sidebar-nav-link")}
              >
                Meal Sponsorships
              </NavLink>
              <NavLink
                to="/staff"
                className={({ isActive }) => (isActive ? "sidebar-nav-link active" : "sidebar-nav-link")}
              >
                Staff
              </NavLink>
            </>
          )}

          <NavLink
            to="/home-profile"
            className={({ isActive }) => (isActive ? "sidebar-nav-link active" : "sidebar-nav-link")}
          >
            Public Profile
          </NavLink>

          <NavLink
            to="/notifications"
            className={({ isActive }) => (isActive ? "sidebar-nav-link active" : "sidebar-nav-link")}
          >
            Notifications
            {unread > 0 && <span className="nav-badge">{unread > 9 ? "9+" : unread}</span>}
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
