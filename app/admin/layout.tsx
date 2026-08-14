import './admin.css';

/**
 * Root Admin Layout — NO session guard here.
 * Session checking lives in app/admin/(protected)/layout.tsx so that
 * /admin/login can render WITHOUT triggering a redirect loop.
 */
export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

