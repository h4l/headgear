export const BUTTON_STYLES = (
  <div
    class={`\
rounded-lg border cursor-pointer
bg-white text-gray-900  border-gray-200
dark:bg-gray-700 dark:text-slate-50 dark:border-gray-600
hover:bg-gray-100 hover:text-blue-700
dark:hover:bg-gray-600 dark:hover:text-white
active:z-10 active:ring-2 active:ring-blue-700 active:text-blue-700
dark:active:ring-blue-300 dark:active:text-blue-200
  disabled:cursor-not-allowed disabled:text-gray-500 disabled:active:ring-0 disabled:active:text-gray-500
  disabled:hover:text-gray-500
  peer-disabled:cursor-not-allowed peer-disabled:text-gray-500 peer-disabled:active:ring-0 peer-disabled:active:text-gray-500
  peer-disabled:hover:text-gray-500
  relative
`}
  />
).props.class;
