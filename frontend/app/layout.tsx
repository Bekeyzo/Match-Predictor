import type { Metadata } from 'next';
import { Archivo, JetBrains_Mono } from 'next/font/google';
import ThemeToggle from '@/components/ThemeToggle';
import NavAuth from '@/components/NavAuth';
import './globals.css';
import { Instagram } from 'lucide-react';

const display = Archivo({
  subsets: ['latin'], variable: '--font-display',
  weight: ['400','500','600','700','800','900'],
});
const mono = JetBrains_Mono({
  subsets: ['latin'], variable: '--font-mono', weight: ['400','500','700'],
});

export const metadata: Metadata = {
  title: 'Tehuti.AI — Football Predictions',
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
        <a href="/" className="nav-mark" aria-label="Tehuti.AI home">
        <img src="/tehuti-for-darkmode.png" alt="Tehuti.AI" />
        </a>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <ThemeToggle />
            <NavAuth />
          </div>
        </nav>

        <main className="wrap">{children}</main>

        <footer className="foot">
        <div className="foot-social">
          <a href="https://x.com/tehuti_ai" target="_blank" rel="noopener noreferrer" aria-label="X" className="foot-icon">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 1.9h3.5l-7.6 8.7 9 11.9h-7l-5.5-7.2-6.3 7.2H1.5l8.2-9.3L1 1.9h7.2l5 6.6 5.7-6.6Zm-1.2 18.4h1.9L6.4 3.8H4.3l13.4 16.5Z"/></svg>
          </a>
          <a href="https://www.instagram.com/tehuti.ai" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="foot-icon">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
          </a>
          <a href="https://www.tiktok.com/@tehuti.ai" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="foot-icon">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.8a4.3 4.3 0 0 1-1-2.6h-3v11.9a2.5 2.5 0 1 1-2.5-2.5c.26 0 .5.04.74.11V9.6a5.6 5.6 0 0 0-.74-.05 5.5 5.5 0 1 0 5.5 5.5V9.01a7.3 7.3 0 0 0 4.2 1.34V7.3a4.3 4.3 0 0 1-3.2-1.5Z"/></svg>
          </a>
          <a href="https://www.reddit.com/u/Tehuti_AI" target="_blank" rel="noopener noreferrer" aria-label="Reddit" className="foot-icon">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a2.06 2.06 0 0 0-3.5-1.44 10.1 10.1 0 0 0-5.3-1.68l.9-4.24 2.96.63a1.5 1.5 0 1 0 .17-1l-3.3-.7a.5.5 0 0 0-.6.38l-1 4.7a10.2 10.2 0 0 0-5.4 1.68 2.06 2.06 0 1 0-2.27 3.35 3.7 3.7 0 0 0-.05.6c0 3.06 3.57 5.54 7.97 5.54s7.97-2.48 7.97-5.54a3.7 3.7 0 0 0-.05-.59A2.06 2.06 0 0 0 22 12ZM7 13.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm8.44 4.02a5.2 5.2 0 0 1-3.44 1.05 5.2 5.2 0 0 1-3.44-1.05.4.4 0 0 1 .56-.57 4.5 4.5 0 0 0 2.88.83 4.5 4.5 0 0 0 2.88-.82.4.4 0 1 1 .56.57Zm-.44-2.52a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"/></svg>
          </a>
        </div>
        <div className="foot-links">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <span>Predictions are estimates, not guarantees</span>
        </div>
      </footer>
      </body>
    </html>
  );
}
