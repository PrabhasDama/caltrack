import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/theme-provider";
export const metadata: Metadata = {
  title: {
    default: "CalTrack — Eat better. Spend smarter.",
    template: "%s · CalTrack",
  },
  description:
    "Personalized nutrition, daily habits, and progress tracking. Eat better. Spend smarter. Reach your goal.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
