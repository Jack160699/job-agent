import { DashboardHeader } from "@/components/dashboard/sidebar";
import { AnswerBankManager } from "@/components/dashboard/answer-bank-manager";

export default function AnswerBankPage() {
  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Application answer bank"
        description="Store confirmed application answers. Kairela pauses instead of guessing missing legal, eligibility, salary, or personal information."
      />
      <AnswerBankManager />
    </div>
  );
}
