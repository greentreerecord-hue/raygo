import * as cheerio from "cheerio";
import { lookup } from "dns/promises";
import { isIP } from "net";
import robotsParser from "robots-parser";
import { saveIndexedPage } from "./crawler-db";

const USER_AGENT =
  "RayGoBot/1.0 (+https://raygoes.com)";
const MAX_PAGES = 5;
const MAX_REDIRECTS = 5;
const MAX_CONTENT_BYTES = 2_000_000;
const REQUEST_TIMEOUT_MS = 10_000;

type CrawlResult = {
  indexed: string[];
  skipped: string[];
  errors: string[];
};

function isPrivateIp(address: string) {
  const normalized = address.toLowerCase();

  if (isIP(normalized) === 4) {
    const parts = normalized.split(".").map(Number);
    const [first, second] = parts;

    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 100 &&
        second >= 64 &&
        second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 &&
        second >= 16 &&
        second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 198 &&
        (second === 18 || second === 19)) ||
      first >= 224
    );
  }

  if (isIP(normalized) === 6) {
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb") ||
      normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:192.168.")
    );
  }

  return true;
}

async function validatePublicUrl(value: string) {
  const url = new URL(value);

  if (
    url.protocol !== "https:" &&
    url.protocol !== "http:"
  ) {
    throw new Error(
      "Only public HTTP and HTTPS pages are allowed."
    );
  }

  if (url.username || url.password) {
    throw new Error(
      "URLs containing usernames or passwords are not allowed."
    );
  }

  if (
    url.hostname === "localhost" ||
    url.hostname.endsWith(".local") ||
    url.hostname.endsWith(".internal")
  ) {
    throw new Error(
      "Private network addresses are not allowed."
    );
  }

  if (
    url.port &&
    url.port !== "80" &&
    url.port !== "443"
  ) {
    throw new Error(
      "Only standard web ports are allowed."
    );
  }

  const addresses = await lookup(url.hostname, {
    all: true,
    verbatim: true,
  });

  if (
    addresses.length === 0 ||
    addresses.some((result) =>
      isPrivateIp(result.address)
    )
  ) {
    throw new Error(
      "The website resolves to a private or unsafe address."
    );
  }

  return url;
}

export async function fetchPublicPage(
  startingUrl: string,
  redirectCount = 0
): Promise<Response> {
  const safeUrl = await validatePublicUrl(
    startingUrl
  );

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(safeUrl, {
      headers: {
        "User-Agent": USER_AGENT,
      },
      redirect: "manual",
      signal: controller.signal,
      cache: "no-store",
    });

    if (
      response.status >= 300 &&
      response.status < 400 &&
      response.headers.get("location")
    ) {
      if (redirectCount >= MAX_REDIRECTS) {
        throw new Error(
          "The website redirected too many times."
        );
      }

      const redirectedUrl = new URL(
        response.headers.get("location")!,
        safeUrl
      );

      return fetchPublicPage(
        redirectedUrl.toString(),
        redirectCount + 1
      );
    }

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function websiteAllowsCrawler(
  pageUrl: URL
) {
  const robotsUrl = new URL(
    "/robots.txt",
    pageUrl.origin
  ).toString();

  try {
    const response =
      await fetchPublicPage(robotsUrl);

    if (response.status === 404) {
      return true;
    }

    if (!response.ok) {
      return false;
    }

    const text = await response.text();
    const robots = robotsParser(
      robotsUrl,
      text
    );

    return (
      robots.isAllowed(
        pageUrl.toString(),
        USER_AGENT
      ) !== false
    );
  } catch {
    return false;
  }
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function canCrawlLink(
  url: URL,
  approvedHostname: string
) {
  const pathname = url.pathname.toLowerCase();

  const blockedFile =
    /\.(jpg|jpeg|png|gif|webp|svg|ico|pdf|zip|mp3|mp4|webm|mov|css|js)$/i.test(
      pathname
    );

  return (
    (url.protocol === "https:" ||
      url.protocol === "http:") &&
    url.hostname === approvedHostname &&
    !blockedFile
  );
}

export async function crawlWebsite(
  seedUrl: string
): Promise<CrawlResult> {
  const seed = await validatePublicUrl(
    seedUrl
  );

  seed.hash = "";

  const approvedHostname = seed.hostname;
  const queue = [seed.toString()];
  const visited = new Set<string>();

  const result: CrawlResult = {
    indexed: [],
    skipped: [],
    errors: [],
  };

  while (
    queue.length > 0 &&
    visited.size < MAX_PAGES
  ) {
    const currentUrl = queue.shift()!;

    if (visited.has(currentUrl)) {
      continue;
    }

    visited.add(currentUrl);

    try {
      const parsedUrl =
        await validatePublicUrl(currentUrl);

      if (
        parsedUrl.hostname !==
        approvedHostname
      ) {
        result.skipped.push(currentUrl);
        continue;
      }

      const allowed =
        await websiteAllowsCrawler(
          parsedUrl
        );

      if (!allowed) {
        result.skipped.push(
          `${currentUrl} (blocked by robots.txt)`
        );
        continue;
      }

      const response =
        await fetchPublicPage(currentUrl);

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const contentType =
        response.headers.get(
          "content-type"
        ) || "";

      if (
        !contentType.includes("text/html")
      ) {
        result.skipped.push(
          `${currentUrl} (not an HTML page)`
        );
        continue;
      }

      const contentLength = Number(
        response.headers.get(
          "content-length"
        ) || "0"
      );

      if (
        contentLength >
        MAX_CONTENT_BYTES
      ) {
        result.skipped.push(
          `${currentUrl} (page is too large)`
        );
        continue;
      }

      const html = await response.text();

      if (
        Buffer.byteLength(
          html,
          "utf8"
        ) > MAX_CONTENT_BYTES
      ) {
        result.skipped.push(
          `${currentUrl} (page is too large)`
        );
        continue;
      }

      const $ = cheerio.load(html);

      $(
        "script, style, noscript, svg, iframe"
      ).remove();

      const title =
        cleanText(
          $("title").first().text()
        ) || parsedUrl.hostname;

      const description = cleanText(
        $('meta[name="description"]').attr(
          "content"
        ) || ""
      );

      const content = cleanText(
        $("body").text()
      ).slice(0, 100_000);

      await saveIndexedPage({
        url: currentUrl,
        hostname:
          parsedUrl.hostname,
        title: title.slice(0, 500),
        description:
          description.slice(0, 1_000),
        content,
        category: "web",
      });

      result.indexed.push(currentUrl);

      $("a[href]").each(
        (_, element) => {
          if (
            queue.length +
              visited.size >=
            MAX_PAGES * 4
          ) {
            return;
          }

          const href = $(element).attr(
            "href"
          );

          if (!href) {
            return;
          }

          try {
            const discoveredUrl =
              new URL(href, currentUrl);

            discoveredUrl.hash = "";

            if (
              canCrawlLink(
                discoveredUrl,
                approvedHostname
              ) &&
              !visited.has(
                discoveredUrl.toString()
              ) &&
              !queue.includes(
                discoveredUrl.toString()
              )
            ) {
              queue.push(
                discoveredUrl.toString()
              );
            }
          } catch {
            // Ignore invalid links.
          }
        }
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown crawler error";

      result.errors.push(
        `${currentUrl}: ${message}`
      );
    }
  }

  return result;
} 
