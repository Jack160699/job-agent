import { redirect } from "next/navigation";
import { isAdminUser } from "@/lib/auth/admin";
import { AdminOpsClient } from "@/components/admin/admin-ops-client";

export default async function AdminOpsPage() {
  if (!(await isAdminUser())) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--ink)]">Operations Console</h1>
        <p className="text-sm text-[var(--ink-secondary)]">
          Production health, queue summary, and launch operations.
        </p>
      </div>
      <AdminOpsClient />
    </div>
  );
}
