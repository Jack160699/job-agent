import { redirect } from "next/navigation";
import { isAdminUser } from "@/lib/auth/admin";
import { AdminQueueClient } from "@/components/admin/admin-queue-client";

export default async function AdminQueuePage() {
  if (!(await isAdminUser())) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--ink)]">Queue Operations</h1>
        <p className="text-sm text-[var(--ink-secondary)]">
          Monitor background jobs, recover stale runs, and manage dead-letter queue.
        </p>
      </div>
      <AdminQueueClient />
    </div>
  );
}
