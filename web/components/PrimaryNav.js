'use client';

// The three primary routes, defined ONCE.
//
// This used to live inside NavBanner, which meant the home page had no navigation at all - Banner.js
// is pure SVG and its only href attributes are <image> sources. With display:"standalone" there is no
// address bar and no back button, so the installed app opened on Today and could not reach Weeks or
// History. One definition, two mount points, no way for the two to drift apart.
//
// The `variant` only chooses a wrapper class; the links, their order and their active rule are
// identical in both. NavBanner passes "nb-nav" so the compact bar keeps its existing appearance
// byte-for-byte; the home page passes "hn-nav", which is styled to sit under the banner.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PRIMARY_ROUTES } from '../lib/routes.js';

export default function PrimaryNav({ className = 'nb-nav' }) {
  const pathname = usePathname();
  return (
    <nav className={className} aria-label="Primary">
      {PRIMARY_ROUTES.map((l) => (
        <Link key={l.href} href={l.href} className={pathname === l.href ? 'on' : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
