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

export function ConsoleLayout() {
  const { user, isAdmin, signOut, token } = useAuth();
  const unread = useUnreadCount(token);
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
          <p className="subtitle">Admin Console</p>
        </div>

        <nav className="sidebar-nav">
          <NavLink
            to="/needs"
            className={({ isActive }) => (isActive ? "sidebar-nav-link active" : "sidebar-nav-link")}
          >
            Needs
          </NavLink>
          <NavLink
            to="/institutions"
            className={({ isActive }) => (isActive ? "sidebar-nav-link active" : "sidebar-nav-link")}
          >
            Institutions
          </NavLink>
          <NavLink
            to="/users"
            className={({ isActive }) => (isActive ? "sidebar-nav-link active" : "sidebar-nav-link")}
          >
            All Users
          </NavLink>
          
          {/* Post a Need is admin-only */}
          {isAdmin && (
            <NavLink
              to="/post"
              className={({ isActive }) => (isActive ? "sidebar-nav-link active" : "sidebar-nav-link")}
            >
              Post a Need
            </NavLink>
          )}

          {/* Staff Accounts is admin-only */}
          {isAdmin && (
            <NavLink
              to="/staff"
              className={({ isActive }) => (isActive ? "sidebar-nav-link active" : "sidebar-nav-link")}
            >
              Staff Accounts
            </NavLink>
          )}

          <NavLink
            to="/locations"
            className={({ isActive }) => (isActive ? "sidebar-nav-link active" : "sidebar-nav-link")}
          >
            Locations
          </NavLink>

          <NavLink
            to="/notifications"
            className={({ isActive }) => (isActive ? "sidebar-nav-link active" : "sidebar-nav-link")}
          >
            Notifications
            {unread > 0 && <span className="nav-badge">{unread > 9 ? "9+" : unread}</span>}
          </NavLink>

          <NavLink
            to="/forum"
            className={({ isActive }) => (isActive ? "sidebar-nav-link active" : "sidebar-nav-link")}
          >
            Forum Moderation
          </NavLink>
          <NavLink
            to="/analytics"
            className={({ isActive }) => (isActive ? "sidebar-nav-link active" : "sidebar-nav-link")}
          >
            Analytics &amp; Metrics
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <p className="user-name">{user?.name ?? "Admin"}</p>
          <p className="user-phone">{user?.phone} ({user?.role})</p>
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
