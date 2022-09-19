import { render } from "preact";

import "./css.css";

const iconArrowDown = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="w-7 h-7 inline m-1"
  >
    <path
      fillRule="evenodd"
      d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75zm-9 13.5a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z"
      clipRule="evenodd"
    />
  </svg>
);

const iconCross = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="w-6 h-6"
  >
    <path
      fillRule="evenodd"
      d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z"
      clipRule="evenodd"
    />
  </svg>
);

render(
  <div class="w-[800px] h-[600px] flex flex-row relative text-base">
    <button
      class="absolute right-0 top-0 m-1 p-2 cursor-pointer text-gray-700 hover:text-gray-600"
      title="Close"
    >
      {iconCross}
    </button>
    <div class="grow bg-slate-700 p-8">
      <img
        class="object-contain w-full h-full drop-shadow-xl"
        src="../img/h4l_dl-repro.svg"
      />
    </div>
    <div class="w-96 flex flex-col bg-neutral-100 text-gray-900 dark:bg-gray-800 dark:text-slate-50">
      <div class="p-4 flex-grow">
        <h1 class="text-3xl font-bold text-center ml-4 mr-4">
          <img class="inline w-14 mb-1 mr-3" src="../img/logo.svg"></img>
          Headgear
        </h1>
        <p class="text-center mx-6 my-4 text-sm">
          Unleash your Reddit Avatar's glorious, vectorised final form.
        </p>
        <hr class="my-4" />

        <h2 class="font-semibold my-3">Image Layout</h2>
        <div class="flex my-2">
          <div class="flex items-center h-5">
            <input
              id="helper-radio"
              aria-describedby="helper-radio-text"
              type="radio"
              name="image-layout"
              value="share"
              class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            ></input>
          </div>
          <div class="ml-2 text-sm">
            <label
              for="helper-radio"
              class="font-medium text-gray-900 dark:text-gray-300"
            >
              White Background
            </label>
            <p
              id="helper-radio-text"
              class="text-xs font-normal text-gray-500 dark:text-gray-300"
            >
              Like the downloadable image from the Reddit avatar builder.
            </p>
          </div>
        </div>
        <div class="flex my-2">
          <div class="flex items-center h-5">
            <input
              id="helper-radio"
              aria-describedby="helper-radio-text"
              type="radio"
              name="image-layout"
              value="background"
              class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            ></input>
          </div>
          <div class="ml-2 text-sm">
            <label
              for="helper-radio"
              class="font-medium text-gray-900 dark:text-gray-300"
            >
              Collectable Avatar Background
            </label>
            <p
              id="helper-radio-text"
              class="text-xs font-normal text-gray-500 dark:text-gray-300"
            >
              Like the version on your profile page.
            </p>
          </div>
        </div>
      </div>
      <div class="text-sm p-4 text-center">
        <p>Support this project if you found it useful.</p>
        <p>
          <span class="rounded bg-slate-700 text-white font-mono my-2 p-2 leading-6">
            0x00000000000000000000
          </span>
        </p>
      </div>
      <a
        class="block flex text-lg font-medium bg-indigo-600 hover:bg-indigo-500 text-slate-50 p-3"
        href="data:text/plain;charset=utf-8,Hello%20World!%0A"
        download="hello.txt"
      >
        <span class="m-auto">
          {iconArrowDown} <span class="m-1">Download SVG Image</span>
        </span>
      </a>
    </div>
  </div>,
  document.body
);
