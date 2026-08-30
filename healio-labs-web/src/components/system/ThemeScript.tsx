import Script from "next/script";

/**
 * Applies the stored theme before first paint so there is no flash of the
 * wrong palette. `beforeInteractive` puts this in the initial HTML, ahead of
 * hydration, which is the only point early enough to matter.
 *
 * Three states: with no `data-theme` attribute the stylesheet follows the
 * system via a prefers-color-scheme query. An explicit choice sets the
 * attribute, which wins over the query.
 *
 * `<html>` carries suppressHydrationWarning because this deliberately mutates
 * an attribute React rendered.
 */
const script = `(function(){try{var t=localStorage.getItem("healio-theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})();`;

export default function ThemeScript() {
  return (
    // The lint rule below predates the App Router, where `beforeInteractive`
    // in the root layout is the documented placement. Verified: the attribute
    // is set before first contentful paint.
    // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document
    <Script
      id="healio-theme"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
