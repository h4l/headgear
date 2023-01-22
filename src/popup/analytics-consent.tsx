import { useSignal } from "@preact/signals";
import { Fragment, JSX } from "preact";
import { useContext, useEffect, useMemo, useState } from "preact/hooks";

import { AnalyticsPreference } from "../popup-state-persistence";
import { getIsIncognitoSignal } from "./incognito";
import { PostHogLogo } from "./posthog-logo";
import { ControlsContext } from "./state";
import { BUTTON_STYLES } from "./styles";

export function AnalyticsConsent(): JSX.Element {
  const controlsState = useContext(ControlsContext);
  const fadingOut = useSignal(false);
  const isIncognito = useMemo(getIsIncognitoSignal, []);

  // The UI is always displayed if an analytics preference has not yet been
  // made. Maybe we should initially disable analytics and defer asking for
  // consent & enabling until a bit later?
  const uiOpen =
    controlsState.value?.analyticsConsentUIOpen ||
    // Only auto-open for NOT_YET_DECIDED on startup if we're not in incognito.
    // (Still allow the window to be opened manually via settings.)
    (controlsState.value?.analyticsPreference ===
      AnalyticsPreference.NOT_YET_DECIDED &&
      isIncognito.value === false);

  // We disable transitions if the UI is starting with the dialog open.
  const [wasClosed, setWasClosed] = useState<boolean>(false);
  useEffect(() => {
    // `=== false` is significant, as undefined is uninitialised, which does not
    // imply the UI is closed.
    if (!wasClosed && controlsState.value?.analyticsConsentUIOpen === false) {
      setWasClosed(true);
    }
  }, [wasClosed, controlsState.value?.analyticsConsentUIOpen]);

  useEffect(() => {
    if (controlsState.value?.analyticsConsentUIOpen) {
      fadingOut.value = true;
    }
  }, [fadingOut, controlsState.value?.analyticsConsentUIOpen]);

  useEffect(() => {
    if (
      uiOpen &&
      !controlsState.value?.analyticsConsentUIOpen &&
      controlsState.value
    ) {
      controlsState.value = {
        ...controlsState.value,
        analyticsConsentUIOpen: true,
      };
    }
  }, [uiOpen, controlsState]);

  const selectConsentPreference = (preference: AnalyticsPreference) => {
    if (!controlsState.value) return;
    controlsState.value = {
      ...controlsState.value,
      analyticsPreference: preference,
      analyticsConsentUIOpen: false,
    };
  };

  return (
    <Fragment>
      <div
        data-testid="modal-bg"
        onTransitionEnd={() => {
          fadingOut.value = false;
        }}
        class={`
        ${
          controlsState.value?.analyticsConsentUIOpen
            ? "opacity-100"
            : fadingOut.value
            ? "opacity-0"
            : "hidden opacity-0"
        }
        transition-opacity
        absolute z-20 left-0 right-0 top-0 bottom-0 bg-gray-900 bg-opacity-50 dark:bg-opacity-80
        `}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Image Output Options"
        aria-hidden={!uiOpen}
        open={uiOpen}
        class={`absolute z-30 shadow-xl ${
          uiOpen
            ? "right-[8%]"
            : fadingOut.value
            ? "-right-[84%]"
            : "-right-[84%] invisible"
        }
        ${!wasClosed && uiOpen ? "transition-none" : "transition-[right]"}
        rounded-md
        bottom-12 p-8
        w-full max-w-[84%]
        flex flex-col
        bg-neutral-100 text-gray-900 dark:bg-gray-800 dark:text-slate-50
        dark:border dark:border-slate-700`}
      >
        <main class="prose dark:prose-invert">
          <h2 class="_text-lg _font-medium _mt-4">
            Headgear Would Like To Share Usage Info
          </h2>
          <p>
            Can Headgear share info on how you use it, to help its creators
            improve it?
          </p>
          <p>Headgear will share:</p>
          <ul>
            <li>
              Info on how it's used, for example which buttons are clicked, how
              long loading data takes, and errors that occur
            </li>
            <li>Info on which Avatars are being used in Headgear</li>
          </ul>
          <p class="flex prose-sm">
            <div>
              <a
                class="float-right h-full flex items-end ml-2"
                style="shape-outside: inset(calc(100% - calc(44px + 0.5rem)) 0 0);"
                href="https://posthog.com/eu"
                target="_blank"
                rel="noreferrer"
              >
                <PostHogLogo class="w-[5.9rem]" />
              </a>
              Thank you. Change your preference at any time in Settings. For
              more info, see{" "}
              <a
                class=""
                href="https://github.com/h4l/headgear/blob/main/docs/privacy-policy.md"
                target="_blank"
                rel="noreferrer"
              >
                Headgear's privacy policy
              </a>
              . Headgear uses{" "}
              <a href="https://posthog.com/eu" target="_blank" rel="noreferrer">
                PostHog EU
              </a>{" "}
              for its analytics.
            </div>
          </p>
          <div class="flex flex-row">
            {[AnalyticsPreference.OPTED_IN, AnalyticsPreference.OPTED_OUT].map(
              (pref, i) => {
                const label =
                  pref === AnalyticsPreference.OPTED_IN
                    ? "Share"
                    : "Don't Share";
                const edgeRounding =
                  i === 0 ? "rounded-r-none" : "rounded-l-none";
                return (
                  <div key={i} class="flex-1 group relative">
                    <input
                      type="radio"
                      id={`analytics-consent-${pref}`}
                      name="analytics-consent"
                      value={pref}
                      checked={
                        controlsState.value?.analyticsPreference === pref
                      }
                      onClick={() => selectConsentPreference(pref)}
                      class="sr-only peer"
                      required
                    />
                    <label
                      class={`
          flex flex-col my-2 p-5
          peer-checked:text-blue-600 peer-checked:border-blue-600
          dark:peer-checked:text-blue-300 dark:peer-checked:border-blue-400
          ${BUTTON_STYLES}
          ${edgeRounding}
        `}
                      for={`analytics-consent-${pref}`}
                    >
                      <div class="font-medium">{label}</div>
                    </label>
                  </div>
                );
              }
            )}
          </div>
        </main>
      </div>
    </Fragment>
  );
}
