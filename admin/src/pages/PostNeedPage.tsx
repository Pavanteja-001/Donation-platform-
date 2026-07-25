import { useState } from "react";
import { CreateMoneyNeedPage } from "./CreateMoneyNeedPage";
import { CreateKitNeedPage } from "./CreateKitNeedPage";
import { CreateBloodNeedPage } from "./CreateBloodNeedPage";

type Screen = { name: "chooser" } | { name: "money" } | { name: "kit" } | { name: "blood" };

// Admin-only (D-018) — post a need on behalf of a beneficiary/partner org that doesn't have
// its own mobile/web-panel account. Goes through the exact same DRAFT -> submit ->
// PENDING_VERIFICATION lifecycle as anyone else's need; find it afterward in the Needs tab.
export function PostNeedPage() {
  const [screen, setScreen] = useState<Screen>({ name: "chooser" });

  if (screen.name === "money") {
    return <CreateMoneyNeedPage onBack={() => setScreen({ name: "chooser" })} onDone={() => setScreen({ name: "chooser" })} />;
  }
  if (screen.name === "kit") {
    return <CreateKitNeedPage onBack={() => setScreen({ name: "chooser" })} onDone={() => setScreen({ name: "chooser" })} />;
  }
  if (screen.name === "blood") {
    return <CreateBloodNeedPage onBack={() => setScreen({ name: "chooser" })} onDone={() => setScreen({ name: "chooser" })} />;
  }

  return (
    <div>
      <h2>Post a need</h2>
      <p className="hint">
        For a beneficiary or partner organization without their own account. It goes through the
        same admin verification as any other submission — check the Needs tab afterward.
      </p>
      <div className="row-actions">
        <button type="button" className="btn" onClick={() => setScreen({ name: "money" })}>
          + Money need
        </button>
        <button type="button" className="btn" onClick={() => setScreen({ name: "kit" })}>
          + Kit need
        </button>
        <button type="button" className="btn" onClick={() => setScreen({ name: "blood" })}>
          + Blood need
        </button>
      </div>
    </div>
  );
}
