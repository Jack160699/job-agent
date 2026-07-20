import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAnswers: vi.fn(),
  findUsage: vi.fn(),
  createUsage: vi.fn(),
  updateAnswer: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  default: {
    applicationAnswerBank: {
      findMany: mocks.findAnswers,
      update: mocks.updateAnswer,
    },
    applicationAnswerUsage: {
      findMany: mocks.findUsage,
      create: mocks.createUsage,
    },
    $transaction: mocks.transaction,
  },
}));

import { recordAnswerBankUsage } from "./answer-bank-service";

describe("recordAnswerBankUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findAnswers.mockResolvedValue([
      {
        id: "answer-1",
        answer: "30 days",
      },
    ]);
    mocks.findUsage.mockResolvedValue([]);
    mocks.createUsage.mockReturnValue(Promise.resolve({ id: "usage-1" }));
    mocks.updateAnswer.mockReturnValue(Promise.resolve({ id: "answer-1" }));
    mocks.transaction.mockResolvedValue([]);
  });

  it("records and increments a confirmed answer once per application", async () => {
    await expect(
      recordAnswerBankUsage("user-1", "application-1", ["notice_period"])
    ).resolves.toBe(1);
    expect(mocks.createUsage).toHaveBeenCalledTimes(1);
    expect(mocks.updateAnswer).toHaveBeenCalledTimes(1);
  });

  it("does not double-count an answer already credited to the application", async () => {
    mocks.findUsage.mockResolvedValue([{ answerBankId: "answer-1" }]);

    await expect(
      recordAnswerBankUsage("user-1", "application-1", ["notice_period"])
    ).resolves.toBe(0);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.updateAnswer).not.toHaveBeenCalled();
  });
});
