import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "./context/AppContext";
import { Topbar } from "./components/Topbar";

export const metadata: Metadata = {
  title: "FinVault Portal",
  description:
    "FinVault mini fintech e-wallet portal and security audit workspace for penetration testing topic B20.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppProvider>
          <div className="app-shell">
            <Topbar />
            {children}
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
