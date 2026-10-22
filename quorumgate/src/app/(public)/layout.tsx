import "../globals.css";

// Root layout for the PUBLIC routes (landing page and /simulation). No TideCloak provider here,
// so these pages work even before TideCloak is bootstrapped.
export const metadata = {
  title: "QuorumGate",
  description: "Zero-blind-trust critical access vault, secured by TideCloak",
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
