/**
 * The `next/font` loaders behind the font allow-list (`design-theme` → Font allow-list;
 * `int-standards.nextjs.md` → Styling: fonts load through `next/font`, never from stored data).
 * Each defines `--font-<id>`; the theme's `--font-sans` / `--font-display` / `--font-mono` point
 * at one of them (`toCssVariables`). Files are self-hosted by Next at build time.
 */
import {
  Fira_Code,
  Fraunces,
  IBM_Plex_Mono,
  Instrument_Serif,
  Inter,
  JetBrains_Mono,
  Manrope,
  Playfair_Display,
  Space_Grotesk,
} from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk', display: 'swap' });
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-instrument-serif',
  display: 'swap',
});
const playfairDisplay = Playfair_Display({ subsets: ['latin'], style: ['normal', 'italic'], variable: '--font-playfair-display', display: 'swap' });
const fraunces = Fraunces({ subsets: ['latin'], style: ['normal', 'italic'], variable: '--font-fraunces', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono', display: 'swap' });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-ibm-plex-mono', display: 'swap' });
const firaCode = Fira_Code({ subsets: ['latin'], variable: '--font-fira-code', display: 'swap' });

/** Every allowed font's variable class, for the document root. */
export const FONT_VARIABLE_CLASSES = [
  inter,
  manrope,
  spaceGrotesk,
  instrumentSerif,
  playfairDisplay,
  fraunces,
  jetbrainsMono,
  ibmPlexMono,
  firaCode,
]
  .map((font) => font.variable)
  .join(' ');
