/** UI preview is available in development only and never bypasses production auth. */
export const UI_PREVIEW_MODE = process.env.NODE_ENV === "development";
