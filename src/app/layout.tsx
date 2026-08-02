import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Informes Interactivos",
  description:
    "Plataforma de informes técnicos interactivos con revisión ministerial y anotaciones contextuales.",
};

// Fija el tema antes del primer render para evitar parpadeo (FOUC).
const themeScript = `
(function () {
  try {
    var t = localStorage.getItem('theme') || 'light';
    var r = document.documentElement;
    r.setAttribute('data-theme', t);
    if (t === 'dark') r.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
