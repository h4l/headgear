import { PostHog } from "posthog-js/dist/module.no-external";

import { MockPostHog } from "../../../src/__tests__/posthog-js.mock";

// The no-external build is ESM, so base the mock on the main CommonJS build,
// which has the same exports.
const mod: typeof import("posthog-js/dist/module.no-external") =
  jest.createMockFromModule("posthog-js");

mod.PostHog = MockPostHog as unknown as typeof PostHog;
mod.default = new MockPostHog() as unknown as PostHog;
mod.posthog = mod.default;
module.exports = mod;
