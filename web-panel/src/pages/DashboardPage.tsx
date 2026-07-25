import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { MyNeedsPage } from "./MyNeedsPage";
import { CreateMoneyNeedPage } from "./CreateMoneyNeedPage";
import { CreateKitNeedPage } from "./CreateKitNeedPage";
import { CreateBloodNeedPage } from "./CreateBloodNeedPage";
import { NeedDetailPage } from "./NeedDetailPage";

type Screen =
  | { name: "list" }
  | { name: "create-money" }
  | { name: "create-kit" }
  | { name: "create-blood" }
  | { name: "detail"; needId: string };

export function DashboardPage() {
  const { user, signOut } = useAuth();
  const [screen, setScreen] = useState<Screen>({ name: "list" });

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>DonationPlatform — Institution Panel</h1>
          <p className="subtitle">
            {user?.name ?? "Institution"} · {user?.phone} · role {user?.role}
          </p>
        </div>
        <button type="button" className="link" onClick={() => signOut()}>
          Log out
        </button>
      </header>
      <main>
        {screen.name === "list" && (
          <MyNeedsPage
            onSelectNeed={(needId) => setScreen({ name: "detail", needId })}
            onCreateMoney={() => setScreen({ name: "create-money" })}
            onCreateKit={() => setScreen({ name: "create-kit" })}
            onCreateBlood={() => setScreen({ name: "create-blood" })}
          />
        )}
        {screen.name === "create-money" && (
          <CreateMoneyNeedPage onBack={() => setScreen({ name: "list" })} onDone={() => setScreen({ name: "list" })} />
        )}
        {screen.name === "create-kit" && (
          <CreateKitNeedPage onBack={() => setScreen({ name: "list" })} onDone={() => setScreen({ name: "list" })} />
        )}
        {screen.name === "create-blood" && (
          <CreateBloodNeedPage onBack={() => setScreen({ name: "list" })} onDone={() => setScreen({ name: "list" })} />
        )}
        {screen.name === "detail" && (
          <NeedDetailPage needId={screen.needId} onBack={() => setScreen({ name: "list" })} />
        )}
      </main>
      <p className="hint" style={{ marginTop: 32 }}>
        KYC onboarding (D-007) and the live status feed (D-008 WebSockets) land in later milestones.
      </p>
    </div>
  );
}
