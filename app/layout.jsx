import "./globals.css";

export const metadata = {
  title: "Poise Connect",
  description: "Poise Klientenanfrage System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
