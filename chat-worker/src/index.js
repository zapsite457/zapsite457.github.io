import knowledge from "../../knowledge/zapsite.md";
import { handle } from "./logic.js";

export default {
  async fetch(request, env) {
    return handle(request, env, knowledge);
  }
};
