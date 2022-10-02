/**
 * This module is injected into a Reddit browser tab. It's responsible for
 * handling requests for avatar data from the main extension (running in a
 * separate context).
 */
import { registerMessageHandler } from "./reddit-interaction";

registerMessageHandler();
