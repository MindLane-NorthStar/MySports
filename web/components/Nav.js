'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Today' },
  { href: '/weeks', label: 'Weeks' },
  { href: '/history', label: 'History' },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="nav">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} data-active={pathname === l.href}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
