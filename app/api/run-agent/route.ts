import { Sandbox } from "@vercel/sandbox";
import { nanoid } from "nanoid";

export const runtime = "nodejs";
export const maxDuration = 120;

type FileBlock = { filename: string; content: string };

const AGENT_FILES: FileBlock[] = [{"filename":"agent/instructions.md","content":"# Personal Assistant Agent\nYou are a personal assistant. Help the user manage tasks and notes.\nAlways call add_task to create tasks, list_tasks to view them, and take_note to save notes. Never do this work in text, then report the tool's result.\nIf the message is not about tasks or notes, answer directly in plain text without calling any tool."},{"filename":"agent/agent.ts","content":"import { defineAgent } from \"eve\";\nexport default defineAgent({\n  model: \"inclusionai/ling-3.0-flash-vl\",\n  modelOptions: {\n    providerOptions: {\n      gateway: {\n        models: [\"inclusionai/ling-3.0-flash-vl-free\", \"inclusionai/ling-3.0-flash-fin\"],\n      },\n    },\n  },\n});"},{"filename":"agent/tools/add_task.ts","content":"import { defineTool } from \"eve/tools\";\nimport { z } from \"zod\";\n\nconst tasks: Array<{ id: number; title: string; priority: string; dueDate?: string; status: string }> = [];\nlet nextId = 1;\n\nexport default defineTool({\n  description: \"Adds a new task with a title, priority, and optional due date\",\n  inputSchema: z.object({\n    title: z.string(),\n    priority: z.enum([\"low\", \"medium\", \"high\"]).optional(),\n    dueDate: z.string().optional(),\n  }),\n  async execute(input) {\n    try {\n      const task = {\n        id: nextId++,\n        title: input.title,\n        priority: input.priority ?? \"medium\",\n        dueDate: input.dueDate,\n        status: \"pending\",\n      };\n      tasks.push(task);\n      return { success: true, task };\n    } catch {\n      return { success: false, message: \"could not add the task\" };\n    }\n  },\n});"},{"filename":"agent/tools/list_tasks.ts","content":"import { defineTool } from \"eve/tools\";\nimport { z } from \"zod\";\n\nconst tasks: Array<{ id: number; title: string; priority: string; dueDate?: string; status: string }> = [];\nlet nextId = 1;\n\nexport default defineTool({\n  description: \"Lists all tasks, optionally filtered by status or priority\",\n  inputSchema: z.object({\n    status: z.enum([\"pending\", \"completed\"]).optional(),\n    priority: z.enum([\"low\", \"medium\", \"high\"]).optional(),\n  }),\n  async execute(input) {\n    try {\n      let result = [...tasks];\n      if (input.status) result = result.filter((t) => t.status === input.status);\n      if (input.priority) result = result.filter((t) => t.priority === input.priority);\n      return { success: true, count: result.length, tasks: result };\n    } catch {\n      return { success: false, message: \"could not list tasks\" };\n    }\n  },\n});"},{"filename":"agent/tools/take_note.ts","content":"import { defineTool } from \"eve/tools\";\nimport { z } from \"zod\";\n\nconst notes: Array<{ id: number; content: string; category?: string }> = [];\nlet nextId = 1;\n\nexport default defineTool({\n  description: \"Saves a note with optional category\",\n  inputSchema: z.object({\n    content: z.string(),\n    category: z.string().optional(),\n  }),\n  async execute(input) {\n    try {\n      const note = { id: nextId++, content: input.content, category: input.category };\n      notes.push(note);\n      return { success: true, note };\n    } catch {\n      return { success: false, message: \"could not save the note\" };\n    }\n  },\n});"},{"filename":"evals/core.eval.ts","content":"import { defineEval } from \"eve/evals\";\n\nexport default defineEval({\n  async test(t) {\n    const addTurn = await t.send(\"add a high priority task to finish the report by tomorrow\");\n    addTurn.calledTool(\"add_task\");\n\n    const offTopicTurn = await t.send(\"what's 2 plus 2\");\n    offTopicTurn.notCalledTool(\"add_task\");\n  },\n});"}];

const OPEN_CHANNEL_AUTH = `import { eveChannel } from "eve/channels/eve";
import { none } from "eve/channels/auth";

export default eveChannel({ auth: [none()] });
`;

async function waitForServer(url: string, timeoutMs: number) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.status < 500) return true;
    } catch {
      // sandbox not accepting connections yet, keep polling
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function getModelEnv() {
  const env: Record<string, string> = {};
  if (process.env.AI_GATEWAY_API_KEY) env.AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY;
  if (process.env.VERCEL_OIDC_TOKEN) env.VERCEL_OIDC_TOKEN = process.env.VERCEL_OIDC_TOKEN;
  if (process.env.ANTHROPIC_API_KEY) env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (process.env.OPENAI_API_KEY) env.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  return env;
}

function getConnectionEnvVars(files: FileBlock[]): string[] {
  const vars = new Set<string>();
  for (const f of files) {
    if (!f.filename.startsWith("agent/connections/")) continue;
    const matches = f.content.matchAll(/process.env.([A-Z0-9_]+)/g);
    for (const m of matches) vars.add(m[1]);
  }
  return [...vars];
}

function getDirectories(files: { filename: string }[]): string[] {
  const dirs = new Set<string>();
  for (const f of files) {
    const parts = f.filename.split("/");
    parts.pop();
    if (parts.length > 0) dirs.add(parts.join("/"));
  }
  return [...dirs];
}

export async function POST() {
  const modelEnv = getModelEnv();
  const connectionVars = getConnectionEnvVars(AGENT_FILES);
  const missingConnectionEnv = connectionVars.filter((v) => !process.env[v]);
  const missingModelEnv = Object.keys(modelEnv).length === 0;

  if (missingModelEnv || missingConnectionEnv.length > 0) {
    const parts: string[] = [];
    if (missingModelEnv) {
      parts.push(
        "a model credential (AI_GATEWAY_API_KEY, or ANTHROPIC_API_KEY / OPENAI_API_KEY)",
      );
    }
    if (missingConnectionEnv.length > 0) {
      parts.push(
        `this agent's connection needs ${missingConnectionEnv.join(", ")}`,
      );
    }

    return Response.json({
      ok: false,
      needsCredentials: true,
      error: `add ${parts.join(" and ")} in this project's vercel settings, then redeploy`,
    });
  }

  const connectionEnv = Object.fromEntries(
    connectionVars
      .filter((v) => process.env[v])
      .map((v) => [v, process.env[v]!]),
  );

  const sandboxName = `eve-agent-${nanoid(8)}`;
  let sandbox;

  try {
    sandbox = await Sandbox.create({
      name: sandboxName,
      runtime: "node24",
      timeout: 600_000,
      ports: [3000],
      env: { ...modelEnv, ...connectionEnv },
      persistent: false,
    });
  } catch (err) {
    console.error("sandbox create failed:", err);
    return Response.json({
      ok: false,
      error: "couldn't start your agent right now, try again in a moment",
    });
  }

  await Promise.all(
    [...getDirectories(AGENT_FILES), "agent/channels"].map((dir) =>
      sandbox.fs.mkdir(dir, { recursive: true }),
    ),
  );

  await sandbox.writeFiles([
    ...AGENT_FILES.map((f) => ({
      path: f.filename,
      content: Buffer.from(f.content),
    })),
    {
      path: "package.json",
      content: Buffer.from(
        JSON.stringify(
          { name: "deployed-eve-agent", private: true, type: "module", dependencies: { eve: "latest" } },
          null,
          2,
        ),
      ),
    },
    { path: "agent/channels/eve.ts", content: Buffer.from(OPEN_CHANNEL_AUTH) },
  ]);

  const install = await sandbox.runCommand({
    cmd: "npm",
    args: ["install", "--no-audit", "--no-fund"],
  });

  if (install.exitCode !== 0) {
    const err = await install.stderr();
    await sandbox.stop();
    return Response.json({ ok: false, error: `install failed: ${err}` });
  }

  await sandbox.runCommand({
    cmd: "npx",
    args: ["eve", "dev", "--no-ui", "--port", "3000"],
    detached: true,
  });

  const url = sandbox.domain(3000);
  const ready = await waitForServer(url, 45_000);

  if (!ready) {
    await sandbox.stop();
    return Response.json({ ok: false, error: "agent didn't start in time" });
  }

  return Response.json({ ok: true, sandboxName, url });
}
