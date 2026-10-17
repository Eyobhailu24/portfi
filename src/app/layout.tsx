import type { Metadata } from "next";
import "@/shared/styles/fonts.css";
import "@/shared/styles/globals.css";

export const metadata: Metadata = {
  title: { default: "Portfi — Good work deserves a beautiful home", template: "%s | Portfi" },
  description: "Create a portfolio that feels like you. Thoughtful templates, easy editing, and beautiful motion. Your work, your code, your own little corner of the internet.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to content</a>{children}</body></html>;
}
