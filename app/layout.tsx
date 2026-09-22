import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Central Pedido | Casa das Mangueiras",
  description: "Sistema de pedidos por fornecedor com catálogo, histórico e exportação em PDF e XLSX.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
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
