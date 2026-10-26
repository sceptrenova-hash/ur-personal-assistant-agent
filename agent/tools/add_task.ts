import { defineTool } from "eve/tools";
import { z } from "zod";

const tasks: Array<{ id: number; title: string; priority: string; dueDate?: string; status: string }> = [];
let nextId = 1;

export default defineTool({
  description: "Adds a new task with a title, priority, and optional due date",
  inputSchema: z.object({
    title: z.string(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    dueDate: z.string().optional(),
  }),
  async execute(input) {
    try {
      const task = {
        id: nextId++,
        title: input.title,
        priority: input.priority ?? "medium",
        dueDate: input.dueDate,
        status: "pending",
      };
      tasks.push(task);
      return { success: true, task };
    } catch {
      return { success: false, message: "could not add the task" };
    }
  },
});