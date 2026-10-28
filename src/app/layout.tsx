import type { Metadata } from 'next';
import { Geist, Geist_Mono, Noto_Sans_Sinhala } from 'next/font/google';

import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { DEFAULT_BRAND } from '@/lib/branding';

import 'katex/dist/katex.min.css';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
// Windows ships Iskoola Pota and phones ship whatever the vendor chose, and
// several of those break conjuncts such as ්‍ය and ්‍ර. One font everywhere
// means every student sees the same, correctly shaped text. Only the
// Sinhala subset is loaded; Geist covers everything else.
const notoSinhala = Noto_Sans_Sinhala({
  variable: '--font-sinhala',
  subsets: ['sinhala'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: `${DEFAULT_BRAND.lms_name} — ${DEFAULT_BRAND.tagline}`,
    template: `%s · ${DEFAULT_BRAND.lms_name}`,
  },
  description: 'A private A/L Physics teaching, assessment and progress-tracking platform.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${notoSinhala.variable} h-full`}>
      <body className="min-h-full antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
