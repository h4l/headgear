import { JSX } from "preact/jsx-runtime";

/**
 * A subset of Tailwind CSS styles to allow test predicates (such as
 * .toBeVisible()) to work.
 */
export function MockTailwindStyles(): JSX.Element {
  const css = `\
.hidden { display: none; }
.invisible { visibility: hidden; }
`;
  // eslint-disable-next-line react/no-danger
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
