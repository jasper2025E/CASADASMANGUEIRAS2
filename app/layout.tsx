import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CDM | Sistema Oficial Casa das Mangueiras",
  description: "Sistema oficial CDM para pedidos, produtos, estoque e gestão da Casa das Mangueiras.",
  icons: {
    icon: "/brand/casa-das-mangueiras-logo.webp",
    shortcut: "/brand/casa-das-mangueiras-logo.webp",
    apple: "/brand/casa-das-mangueiras-logo.webp",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
