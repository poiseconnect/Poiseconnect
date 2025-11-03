export const metadata = {
  title: "Poise Connect",
  description: "Poise Anfrageformular",
};

import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>
        {children}
      </body>
    </html>
  );
}
