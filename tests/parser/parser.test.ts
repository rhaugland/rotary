import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseMessage } from "../../src/parser/parser.js";

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return {
        messages: {
          create: vi.fn(),
        },
      };
    }),
  };
});

import Anthropic from "@anthropic-ai/sdk";

describe("parseMessage", () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockCreate = vi.fn();
    (Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return { messages: { create: mockCreate } };
    });
  });

  it("parses a create_task intent", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({
        intent: "create_task", taskTitle: "finish the logo", assigneeName: "Jake",
        dueDate: "2026-04-11", status: null, comment: null, confidence: 0.95,
      })}],
    });
    const result = await parseMessage("Jake needs to finish the logo by Friday", "2026-04-07", ["Jake", "Carol", "Ryan"]);
    expect(result.intent).toBe("create_task");
    expect(result.taskTitle).toBe("finish the logo");
    expect(result.assigneeName).toBe("Jake");
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("parses an update_status intent", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({
        intent: "update_status", taskTitle: null, assigneeName: null,
        dueDate: null, status: "done", comment: null, confidence: 0.98,
      })}],
    });
    const result = await parseMessage("done", "2026-04-07", ["Jake"]);
    expect(result.intent).toBe("update_status");
    expect(result.status).toBe("done");
  });

  it("returns unknown intent for unparseable messages", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({
        intent: "unknown", taskTitle: null, assigneeName: null,
        dueDate: null, status: null, comment: null, confidence: 0.3,
      })}],
    });
    const result = await parseMessage("lol what", "2026-04-07", ["Jake"]);
    expect(result.intent).toBe("unknown");
    expect(result.confidence).toBeLessThan(0.7);
  });
});
