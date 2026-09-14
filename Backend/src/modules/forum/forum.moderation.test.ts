import { describe, expect, it, vi } from "vitest";

vi.mock("../content-moderation/content-moderation.service", () => ({
  contentModerationService: {
    evaluate: vi.fn(() => ({
      decision: "ALLOW",
      ruleId: "ALLOW_DEFAULT",
      ruleVersion: "es-AR-1.1",
      policyVersion: "es-AR-1.1",
      domain: "FORUM",
      severity: "NONE",
      contentHash: "a".repeat(64),
      categories: [],
      shadowMatches: [{ ruleId: "AR-NEW-1", decision: "BLOCK", categories: ["INSULT"] }]
    }))
  }
}));
vi.mock("../notifications/notifications.service", () => ({ notificationsService: { enqueue: vi.fn() } }));

import { evaluateForumContent } from "./forum.moderation";

describe("evaluateForumContent", () => {
  it("publica según la regla aplicada y guarda las coincidencias en shadow como evidencia", () => {
    const evaluation = evaluateForumContent("reply", "Texto con una palabra nueva");
    expect(evaluation.row.status).toBe("PUBLISHED");
    expect(evaluation.decision).toMatchObject({
      policyVersion: "es-AR-1.1",
      ruleId: "ALLOW_DEFAULT",
      evidence: { shadowRuleIds: ["AR-NEW-1"] }
    });
  });
});
