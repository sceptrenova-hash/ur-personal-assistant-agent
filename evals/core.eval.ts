import { defineEval } from "eve/evals";

export default defineEval({
  async test(t) {
    const addTurn = await t.send("add a high priority task to finish the report by tomorrow");
    addTurn.calledTool("add_task");

    const offTopicTurn = await t.send("what's 2 plus 2");
    offTopicTurn.notCalledTool("add_task");
  },
});