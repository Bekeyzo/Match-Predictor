import type { Metadata } from 'next';
import { Archivo, JetBrains_Mono } from 'next/font/google';
import ThemeToggle from '@/components/ThemeToggle';
import NavAuth from '@/components/NavAuth';
import './globals.css';

const display = Archivo({
  subsets: ['latin'], variable: '--font-display',
  weight: ['400','500','600','700','800','900'],
});
const mono = JetBrains_Mono({
  subsets: ['latin'], variable: '--font-mono', weight: ['400','500','700'],
});

export const metadata: Metadata = {
  title: 'MatchIQ — Football Form & Predictions',
  description: 'Model-led match predictions across European leagues',
};

const noFlash = `
(function(){
  try {
    // Dark by default — users can switch, and their choice is remembered
    var saved = localStorage.getItem('theme');
    document.documentElement.setAttribute('data-theme', saved || 'dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${display.variable} ${mono.variable}`}>
        <script dangerouslySetInnerHTML={{ __html: noFlash }} />

        <nav className="nav">
          <a href="/" className="nav-mark">Match<em>IQ</em></a>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <a href="/" className="nav-link">Leagues</a>
            <ThemeToggle />
            <NavAuth />
          </div>
        </nav>

        <main className="wrap">{children}</main>

        <footer className="foot">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <span>Predictions are estimates, not guarantees</span>
        </footer>
      </body>
    </html>
  );
}
