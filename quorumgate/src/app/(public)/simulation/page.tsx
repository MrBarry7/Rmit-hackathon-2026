"use client";

import { useMemo, useRef, useState } from "react";
import { QuorumConsole } from "@/components/QuorumConsole";
import { SIM_PERSONAS, simulationApi } from "@/lib/quorum/clientApi";

// SIMULATION MODE (MOCKED). No TideCloak, no network: two fake admins share one browser and the
// segmented control decides who is "signed in". Use it to explain the flow, or if TideCloak is
// unreachable. The live, TideCloak-verified version is at /dashboard.
export default function SimulationPage() {
  const [idx, setIdx] = useState(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  // One engine instance for the page; the getter reads whichever persona is active.
  const api = useMemo(() => simulationApi(() => SIM_PERSONAS[idxRef.current]), []);
  const persona = SIM_PERSONAS[idx];

  return (
    <QuorumConsole
      api={api}
      title={persona.title.split(" · ")[1]}
      refreshKey={idx}
      headerRight={
        <div className="segmented" role="tablist" aria-label="Switch simulated admin">
          {SIM_PERSONAS.map((p, i) => (
            <button key={p.sub} role="tab" aria-selected={i === idx} className={i === idx ? "on" : ""} onClick={() => setIdx(i)}>
              {p.title.split(" · ")[0]}
            </button>
          ))}
        </div>
      }
    />
  );
}
