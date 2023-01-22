import { Signal, signal } from "@preact/signals";
import { fireEvent, render, screen, waitFor } from "@testing-library/preact";

import { mockChrome } from "../../__tests__/chrome.mock";
import { MockTailwindStyles } from "../../__tests__/tailwind-styles.mock";

import {
  AnalyticsPreference,
  DEFAULT_CONTROLS_STATE,
} from "../../popup-state-persistence";
import { AnalyticsConsent } from "../analytics-consent";
import { getIsIncognitoSignal } from "../incognito";
import { ControlsContext, ControlsState } from "../state";

jest.mock("../incognito");
beforeEach(() => {
  window.chrome = mockChrome();
});
afterEach(() => {
  delete (window as unknown as Record<string, unknown>).chrome;
});

function renderAnalyticsConsent(
  controlsState: ControlsState
): Signal<ControlsState> {
  const controlsStateSignal = signal<ControlsState>(controlsState);

  render(
    <ControlsContext.Provider value={controlsStateSignal}>
      <main>
        <MockTailwindStyles />
        <AnalyticsConsent />
      </main>
    </ControlsContext.Provider>
  );

  return controlsStateSignal;
}

describe("<AnalyticsConsent>", () => {
  describe("Consent buttons checked state reflects previous consent decision", () => {
    test.each`
      preference                             | shareChecked | dontShareChecked
      ${AnalyticsPreference.NOT_YET_DECIDED} | ${false}     | ${false}
      ${AnalyticsPreference.OPTED_IN}        | ${true}      | ${false}
      ${AnalyticsPreference.OPTED_OUT}       | ${false}     | ${true}
    `(
      'When the user preference is $preference "Share" radio checked is $shareChecked and "Don\'t Share" checked is $dontShareChecked',
      async (options: {
        preference: AnalyticsPreference;
        shareChecked: boolean;
        dontShareChecked: boolean;
      }) => {
        renderAnalyticsConsent({
          ...DEFAULT_CONTROLS_STATE,
          analyticsConsentUIOpen: true,
          analyticsPreference: options.preference,
        });
        const shareIsChecked = !!screen.queryByRole("radio", {
          name: "Share",
          checked: true,
        });
        const dontShareIsChecked = !!screen.queryByRole("radio", {
          name: "Don't Share",
          checked: true,
        });
        expect(shareIsChecked).toBe(options.shareChecked);
        expect(dontShareIsChecked).toBe(options.dontShareChecked);
      }
    );
  });

  describe("Clicking a consent button saves a choice and closes the dialog", () => {
    test.each`
      label            | preference
      ${"Share"}       | ${AnalyticsPreference.OPTED_IN}
      ${"Don't Share"} | ${AnalyticsPreference.OPTED_OUT}
    `(
      'Clicking "$label" sets user preference to $preference',
      async (options: { label: string; preference: AnalyticsPreference }) => {
        const controlsState = renderAnalyticsConsent({
          ...DEFAULT_CONTROLS_STATE,
          analyticsConsentUIOpen: true,
          analyticsPreference: AnalyticsPreference.NOT_YET_DECIDED,
        });
        const share = screen.getByRole("radio", { name: options.label });
        fireEvent.click(share);
        await waitFor(async () => {
          expect(controlsState.value?.analyticsPreference).toBe(
            options.preference
          );
          expect(controlsState.value?.analyticsConsentUIOpen).toBe(false);
        });
      }
    );
  });

  describe("modal is visible when analyticsConsentUIOpen is true", () => {
    test("modal is visible by default when no consent choice has been made", async () => {
      renderAnalyticsConsent({
        ...DEFAULT_CONTROLS_STATE,
        analyticsConsentUIOpen: false,
        analyticsPreference: AnalyticsPreference.NOT_YET_DECIDED,
      });

      expect(await screen.getByRole("dialog")).toBeVisible();
      expect(await screen.getByTestId("modal-bg")).toBeVisible();
    });

    test("modal is visible when analyticsConsentUIOpen is true", async () => {
      renderAnalyticsConsent({
        ...DEFAULT_CONTROLS_STATE,
        analyticsConsentUIOpen: true,
      });

      expect(await screen.getByRole("dialog")).toBeVisible();
      expect(await screen.getByTestId("modal-bg")).toBeVisible();
    });

    test("modal is hidden when analyticsConsentUIOpen is false", async () => {
      renderAnalyticsConsent({
        ...DEFAULT_CONTROLS_STATE,
        analyticsConsentUIOpen: false,
        analyticsPreference: AnalyticsPreference.OPTED_IN,
      });

      expect(
        await screen.getByRole("dialog", { hidden: true })
      ).not.toBeVisible();
      expect(await screen.getByTestId("modal-bg")).not.toBeVisible();
    });

    test("modal is hidden by default in incognito when no consent choice has been made", async () => {
      jest.mocked(getIsIncognitoSignal).mockReturnValueOnce(signal(true));

      renderAnalyticsConsent({
        ...DEFAULT_CONTROLS_STATE,
        analyticsConsentUIOpen: false,
        analyticsPreference: AnalyticsPreference.NOT_YET_DECIDED,
      });

      expect(
        await screen.getByRole("dialog", { hidden: true })
      ).not.toBeVisible();
      expect(await screen.getByTestId("modal-bg")).not.toBeVisible();
    });
  });
});
