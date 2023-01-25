import { PostHog } from "posthog-js";

import { assert } from "../assert";
import { AnalyticsPreference } from "../popup-state-persistence";

export type OptInOut =
  | AnalyticsPreference.OPTED_IN
  | AnalyticsPreference.OPTED_OUT;
type ResetState = { capturingPreference?: OptInOut };

export class MockPostHog
  implements
    Pick<
      PostHog,
      | "capture"
      | "init"
      | "opt_in_capturing"
      | "opt_out_capturing"
      | "has_opted_in_capturing"
      | "has_opted_out_capturing"
      | "register"
    >
{
  capture: PostHog["capture"] = jest.fn();
  init: PostHog["init"] = jest.fn();
  register: PostHog["register"] = jest.fn();

  #capturingPreference: OptInOut = AnalyticsPreference.OPTED_IN;
  constructor() {
    this.resetState();
    jest.mocked(this.init).mockReturnValue(this as unknown as PostHog);
    const spyable = this as unknown as Record<keyof PostHog, () => undefined>;
    jest.spyOn(spyable, "has_opted_out_capturing");
    jest.spyOn(spyable, "opt_in_capturing");
    jest.spyOn(spyable, "opt_out_capturing");
  }

  /**
   * Reset the instance state of this [Mock]PostHog object. Does not reset/clear
   * the mock functions themselves.
   */
  resetState(state?: ResetState) {
    this.#capturingPreference =
      state?.capturingPreference ?? AnalyticsPreference.OPTED_IN;
    assert(
      this.#capturingPreference === AnalyticsPreference.OPTED_IN ||
        this.#capturingPreference === AnalyticsPreference.OPTED_OUT
    );
  }

  has_opted_out_capturing(): boolean {
    return this.#capturingPreference === AnalyticsPreference.OPTED_OUT;
  }
  has_opted_in_capturing(): boolean {
    return this.#capturingPreference === AnalyticsPreference.OPTED_IN;
  }
  opt_in_capturing(): void {
    this.#capturingPreference = AnalyticsPreference.OPTED_IN;
  }
  opt_out_capturing(): void {
    this.#capturingPreference = AnalyticsPreference.OPTED_OUT;
  }
}

export function mockedPostHog(postHog: MockPostHog | PostHog): MockPostHog {
  if (!(postHog instanceof MockPostHog))
    throw new TypeError("object is not a MockPostHog instance");
  return postHog;
}

export function resetMockPostHog(
  postHog: MockPostHog | PostHog,
  state?: ResetState
) {
  mockedPostHog(postHog).resetState(state);
}
