import "./globals.css";

export const metadata = {
  title: "TicketApp — Support",
  description: "Système de gestion de tickets",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
