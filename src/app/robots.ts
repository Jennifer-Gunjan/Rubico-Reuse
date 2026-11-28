import type { MetadataRoute } from "next";

/**
 * Listing pages already carry a noindex tag, but a tag only works once a crawler has
 * fetched the page, and nothing told crawlers to stay away in the first place. There was
 * also no robots.txt at all: the request was redirected to the sign-in page, so a crawler
 * received a login screen instead of crawl directives.
 *
 * Nothing here is for search engines. Every page that shows anything either lists
 * colleagues' items - the landing preview, Browse, a listing - or is behind sign-in. Those
 * items belong to the people who listed them rather than to the web, so the whole site is
 * disallowed rather than picking pages off one at a time and missing one later.
 *
 * The app stays reachable by link, which is how colleagues get here in any case.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: "*",
      // "/" covers the landing page, whose preview grid lists live item titles.
      disallow: "/",
    }],
  };
}
