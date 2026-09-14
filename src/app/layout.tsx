import type { Metadata } from "next";
import { Poppins, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/store/store";
import { Shell } from "@/components/Shell";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Pegasus HS1 · Teamweekend Controlekamer",
  description:
    "Gereedheidspoort, BZT-optimalisatie en Bob-risico-index voor de teamweekenden van Pegasus Heren 1, Nijmegen. Hup blauw.",
  icons: { icon: "/pegasus-logo-256.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={`${poppins.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <StoreProvider>
          <Shell>{children}</Shell>
        </StoreProvider>
      </body>
    </html>
  );
}
