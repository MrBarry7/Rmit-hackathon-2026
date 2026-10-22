import "../globals.css";
import { Providers } from "./providers";

// Root layout for the LIVE routes (/dashboard, /auth/redirect). These need TideCloak, so they
// get the TideCloakProvider (and the adapter config in data/tidecloak.json).
export const metadata = {
  title: "QuorumGate · Live console",
  description: "Zero-blind-trust critical access vault, secured by TideCloak",
};

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
