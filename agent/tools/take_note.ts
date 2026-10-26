import { defineTool } from "eve/tools";
import { z } from "zod";

const notes: Array<{ id: number; content: string; category?: string }> = [];
let nextId = 1;

export default defineTool({
  description: "Saves a note with optional category",
  inputSchema: z.object({
    content: z.string(),
    category: z.string().optional(),
  }),
  async execute(input) {
    try {
      const note = { id: nextId++, content: input.content, category: input.category };
      notes.push(note);
      return { success: true, note };
    } catch {
      return { success: false, message: "could not save the note" };
    }
  },
});