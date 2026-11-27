import type { MetadataRoute } from "next";

/**
 * Listing pages already carry a noindex tag, but a tag only works once a crawler has
 * fetched the page, and nothing told crawlers to stay away in the first place. There was
 * also no robots.txt at all: the request was redirected to the sign-in page, so a crawler
 * received a login screen instead of crawl directives.
 *
 * Browse and the listing pages are kept out of search results by decision: they carry
 * colleagues' items, which belong to the people who use the app rather than to the web.
 * The signed-in pages are listed too. They already redirect to sign-in, so this changes
 * nothing for a crawler, but saying so is cheaper than relying on that redirect staying
 * in place.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: "*",
      disallow: ["/browse", "/listings/", "/my", "/wanted", "/profile", "/notifications", "/api/"],
    }],
  };
}
