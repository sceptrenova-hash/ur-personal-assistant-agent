import { defineAgent } from "eve";
export default defineAgent({
  model: "inclusionai/ling-3.0-flash-vl",
  modelOptions: {
    providerOptions: {
      gateway: {
        models: ["inclusionai/ling-3.0-flash-vl-free", "inclusionai/ling-3.0-flash-fin"],
      },
    },
  },
});