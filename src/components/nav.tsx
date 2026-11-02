import Link from "next/link";
import { auth } from "@/auth";
import { logout } from "@/app/actions";

export async function Nav() {
  const session = await auth();
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          after<span className="text-accent">set</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {session?.user ? (
            <>
              <Link href="/sets/new" className="hover:text-accent">Add set</Link>
              <Link href="/tracked" className="hover:text-accent">Tracked IDs</Link>
              <span className="text-muted">@{session.user.username ?? session.user.email}</span>
              <form action={logout}><button className="btn-ghost">Log out</button></form>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-accent">Log in</Link>
              <Link href="/signup" className="btn">Sign up</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
