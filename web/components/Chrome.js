'use client';

// Picks the page chrome by route: the full banner on the home page, the compact bar everywhere else.
//
// The banner arrives as a PROP, already rendered on the server. A client component cannot import a
// server component, but it can place one it was handed - so Banner keeps reading the layout JSON at
// build time and ships no JavaScript, while the one thing that genuinely needs the client (the
// pathname) stays here.

import { usePathname } from 'next/navigation';
import NavBanner from './NavBanner.js';

export default function Chrome({ banner }) {
  return usePathname() === '/' ? banner : <NavBanner />;
}
