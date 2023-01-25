import { PostHog } from "posthog-js";

import { MockPostHog } from "../src/__tests__/posthog-js.mock";

const mod: typeof import("posthog-js") =
  jest.createMockFromModule("posthog-js");

mod.PostHog = MockPostHog as unknown as typeof PostHog;
mod.default = new MockPostHog() as unknown as PostHog;
mod.posthog = mod.default;
module.exports = mod;
