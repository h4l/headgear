import { PostHog as _PostHog } from "posthog-js";

class PostHog
  implements
    Pick<
      _PostHog,
      "init" | "opt_in_capturing" | "opt_out_capturing" | "register"
    >
{
  init: _PostHog["init"] = jest.fn();
  opt_in_capturing: _PostHog["opt_in_capturing"] = jest.fn();
  opt_out_capturing: _PostHog["opt_out_capturing"] = jest.fn();
  register: _PostHog["register"] = jest.fn();
  constructor() {
    jest.mocked(this.init).mockReturnValue(this as unknown as _PostHog);
  }
}

const mod: typeof import("posthog-js") =
  jest.createMockFromModule("posthog-js");

mod.PostHog = PostHog as typeof _PostHog;
mod.default = new PostHog() as _PostHog;
mod.posthog = mod.default;
module.exports = mod;
