import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAnswer: vi.fn(),
  findApplication: vi.fn(),
  findAnswers: vi.fn(),
  findUser: vi.fn(),
  queryRaw: vi.fn(),
  findUsage: vi.fn(),
  createUsage: vi.fn(),
  updateAnswer: vi.fn(),
  updateManyAnswers: vi.fn(),
  deleteManyUsage: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  default: {
    user: { findUnique: mocks.findUser },
    application: { findFirst: mocks.findApplication },
    applicationAnswerBank: {
      findFirst: mocks.findAnswer,
      findFirstOrThrow: mocks.findAnswer,
      findMany: mocks.findAnswers,
      update: mocks.updateAnswer,
      updateMany: mocks.updateManyAnswers,
    },
    applicationAnswerUsage: {
      findFirst: mocks.findUsage,
      findMany: mocks.findUsage,
      create: mocks.createUsage,
      deleteMany: mocks.deleteManyUsage,
    },
    $queryRaw: mocks.queryRaw,
    $transaction: mocks.transaction,
  },
}));

import {
  creditApplicationAnswerUsage,
  creditProvisionedAnswerUsage,
  recordAnswerBankUsage,
  revokeApplicationAnswerUsage,
} from "./answer-bank-service";

describe("creditApplicationAnswerUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUser.mockResolvedValue({ id: "user-1" });
    mocks.findAnswer.mockResolvedValue({
      id: "answer-1",
      questionKey: "notice_period",
      confirmationState: "confirmed",
      usageCount: 0,
      answer: "30 days",
    });
    mocks.findApplication.mockResolvedValue({ id: "application-1" });
    mocks.findAnswers.mockResolvedValue([
      { id: "answer-1", questionKey: "notice_period" },
    ]);
    mocks.queryRaw.mockResolvedValue([
      {
        inserted: true,
        already_recorded: false,
        current_usage_count: 1,
        usage_record_id: "usage-1",
      },
    ]);
  });

  it("inserts first usage and returns count 1", async () => {
    await expect(
      creditApplicationAnswerUsage({
        userId: "user-1",
        applicationId: "application-1",
        answerBankId: "answer-1",
        fieldKey: "notice_period",
      })
    ).resolves.toMatchObject({
      inserted: true,
      alreadyRecorded: false,
      currentUsageCount: 1,
      usageRecordId: "usage-1",
    });
  });

  it("duplicate callback does not insert a second row or increment", async () => {
    mocks.queryRaw.mockResolvedValue([
      {
        inserted: false,
        already_recorded: true,
        current_usage_count: 1,
        usage_record_id: "usage-1",
      },
    ]);
    await expect(
      creditApplicationAnswerUsage({
        userId: "user-1",
        applicationId: "application-1",
        answerBankId: "answer-1",
      })
    ).resolves.toMatchObject({
      inserted: false,
      alreadyRecorded: true,
      currentUsageCount: 1,
    });
  });

  it("rejects answers owned by another user", async () => {
    mocks.findAnswer.mockResolvedValue(null);
    await expect(
      creditApplicationAnswerUsage({
        userId: "user-1",
        applicationId: "application-1",
        answerBankId: "answer-other",
      })
    ).rejects.toThrow("ANSWER_NOT_OWNED_OR_MISSING");
  });

  it("rejects applications owned by another user", async () => {
    mocks.findApplication.mockResolvedValue(null);
    await expect(
      creditApplicationAnswerUsage({
        userId: "user-1",
        applicationId: "application-other",
        answerBankId: "answer-1",
      })
    ).rejects.toThrow("APPLICATION_NOT_OWNED");
  });

  it("handles deleted answers safely", async () => {
    mocks.findAnswer.mockResolvedValue(null);
    await expect(
      creditApplicationAnswerUsage({
        userId: "user-1",
        applicationId: "application-1",
        answerBankId: "missing",
      })
    ).rejects.toThrow("ANSWER_NOT_OWNED_OR_MISSING");
  });
});

describe("creditProvisionedAnswerUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUser.mockResolvedValue({ id: "user-1" });
    mocks.findAnswer.mockResolvedValue({
      id: "answer-1",
      questionKey: "notice_period",
      confirmationState: "confirmed",
      usageCount: 0,
      answer: "30 days",
    });
    mocks.findApplication.mockResolvedValue({ id: "application-1" });
    mocks.findAnswers.mockResolvedValue([
      { id: "answer-1", questionKey: "notice_period" },
    ]);
    mocks.queryRaw.mockResolvedValue([
      {
        inserted: true,
        already_recorded: false,
        current_usage_count: 1,
        usage_record_id: "usage-1",
      },
    ]);
  });

  it("direct preparation path credits once", async () => {
    const summary = await creditProvisionedAnswerUsage(
      "user-1",
      "application-1",
      ["notice_period"],
      "direct_preparation"
    );
    expect(summary.inserted).toHaveLength(1);
    expect(summary.currentUsageCounts.notice_period).toBe(1);
  });

  it("queued preparation path credits once", async () => {
    const summary = await creditProvisionedAnswerUsage(
      "user-1",
      "application-1",
      ["notice_period"],
      "queued_preparation"
    );
    expect(summary.inserted).toHaveLength(1);
  });

  it("browser-worker callback after queued credit remains idempotent", async () => {
    mocks.queryRaw.mockResolvedValue([
      {
        inserted: false,
        already_recorded: true,
        current_usage_count: 1,
        usage_record_id: "usage-1",
      },
    ]);
    const summary = await creditProvisionedAnswerUsage(
      "user-1",
      "application-1",
      ["notice_period"],
      "browser_worker"
    );
    expect(summary.inserted).toHaveLength(0);
    expect(summary.alreadyPresent).toHaveLength(1);
    expect(summary.currentUsageCounts.notice_period).toBe(1);
  });

  it("failed preparation does not credit when keys are empty", async () => {
    const summary = await creditProvisionedAnswerUsage(
      "user-1",
      "application-1",
      [],
      "failed_preparation"
    );
    expect(summary.inserted).toHaveLength(0);
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });

  it("skips credit after account deletion begins", async () => {
    mocks.findUser.mockResolvedValue(null);
    const summary = await creditProvisionedAnswerUsage(
      "user-1",
      "application-1",
      ["notice_period"]
    );
    expect(summary.inserted).toHaveLength(0);
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });

  it("legacy recordAnswerBankUsage returns inserted count", async () => {
    await expect(
      recordAnswerBankUsage("user-1", "application-1", ["notice_period"])
    ).resolves.toBe(1);
  });
});

describe("revokeApplicationAnswerUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryRaw.mockResolvedValue([
      { revoke_application_answer_usage: 1 },
    ]);
  });

  it("cancelled preparation can revoke previously credited usage", async () => {
    await expect(
      revokeApplicationAnswerUsage("user-1", "application-1")
    ).resolves.toBe(1);
  });
});

describe("concurrent credit calls", () => {
  it("two concurrent calls create one usage record", async () => {
    mocks.findUser.mockResolvedValue({ id: "user-1" });
    mocks.findAnswer.mockResolvedValue({
      id: "answer-1",
      questionKey: "notice_period",
      confirmationState: "confirmed",
      usageCount: 0,
      answer: "30 days",
    });
    mocks.findApplication.mockResolvedValue({ id: "application-1" });
    let calls = 0;
    mocks.queryRaw.mockImplementation(async () => {
      calls += 1;
      return [
        {
          inserted: calls === 1,
          already_recorded: calls !== 1,
          current_usage_count: 1,
          usage_record_id: "usage-1",
        },
      ];
    });

    const [first, second] = await Promise.all([
      creditApplicationAnswerUsage({
        userId: "user-1",
        applicationId: "application-1",
        answerBankId: "answer-1",
      }),
      creditApplicationAnswerUsage({
        userId: "user-1",
        applicationId: "application-1",
        answerBankId: "answer-1",
      }),
    ]);

    expect([first.inserted, second.inserted].filter(Boolean)).toHaveLength(1);
    expect(first.currentUsageCount).toBe(1);
    expect(second.currentUsageCount).toBe(1);
  });
});
