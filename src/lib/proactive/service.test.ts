import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { isDeletedRecommendationOwnerError } from "./service";

describe("recommendation owner cleanup races", () => {
  it("recognizes only the deleted-owner foreign-key race", () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      "Owner was deleted during recommendation creation",
      {
        code: "P2003",
        clientVersion: "test",
        meta: {
          constraint: "proactive_recommendations_user_id_fkey",
        },
      }
    );

    expect(isDeletedRecommendationOwnerError(error)).toBe(true);
  });

  it("does not hide unrelated database failures", () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      "Different constraint",
      {
        code: "P2003",
        clientVersion: "test",
        meta: { constraint: "jobs_user_id_fkey" },
      }
    );

    expect(isDeletedRecommendationOwnerError(error)).toBe(false);
    expect(isDeletedRecommendationOwnerError(new Error("network"))).toBe(false);
  });
});
