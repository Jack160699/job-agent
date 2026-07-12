import { Bot } from "lucide-react";
import Link from "next/link";

export function AuthLayout({
  children,
  title,
  description,
}: {
  children: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/15 via-zinc-950 to-zinc-950" />
      <header className="relative z-10 flex h-16 items-center px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-violet-500">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight">Job Agent</span>
        </Link>
      </header>
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">{title}</h1>
            <p className="mt-2 text-sm text-zinc-400">{description}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-zinc-800" />
      </div>
      <div className="relative flex justify-center text-xs">
        <span className="bg-zinc-900/80 px-3 text-zinc-500">or continue with email</span>
      </div>
    </div>
  );
}
