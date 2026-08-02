import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

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
    <html
      lang="es"
      data-theme="light"
      suppressHydrationWarning
      className={`${inter.variable} ${serif.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
