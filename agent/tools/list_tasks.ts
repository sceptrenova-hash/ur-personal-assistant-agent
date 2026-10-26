import { defineTool } from "eve/tools";
import { z } from "zod";

const tasks: Array<{ id: number; title: string; priority: string; dueDate?: string; status: string }> = [];
let nextId = 1;

export default defineTool({
  description: "Lists all tasks, optionally filtered by status or priority",
  inputSchema: z.object({
    status: z.enum(["pending", "completed"]).optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
  }),
  async execute(input) {
    try {
      let result = [...tasks];
      if (input.status) result = result.filter((t) => t.status === input.status);
      if (input.priority) result = result.filter((t) => t.priority === input.priority);
      return { success: true, count: result.length, tasks: result };
    } catch {
      return { success: false, message: "could not list tasks" };
    }
  },
});