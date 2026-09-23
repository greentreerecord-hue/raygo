import * as cheerio from "cheerio";
import { lookup } from "dns/promises";
import { isIP } from "net";
import robotsParser from "robots-parser";
import { saveIndexedPage } from "./crawler-db";

const USER_AGENT = "RayGoBot/1.0 (+https://raygoes.com)";
const MAX_PAGES = 5;
const MAX_REDIRECTS = 5;
const MAX_CONTENT_BYTES = 2_000_000;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_IMAGES_PER_PAGE = 10;
const MAX_VIDEOS_PER_PAGE = 10;

type CrawlResult = {
  indexed: string[];
  skipped: string[];
  errors: string[];
};

type ImageCandidate = {
  url: string;
  title: string;
  description: string;
};

type VideoCandidate = {
  url: string;
  title: string;
  description: string;
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
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
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
  const safeUrl = await validatePublicUrl(startingUrl);

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

    const location =
      response.headers.get("location");

    if (
      response.status >= 300 &&
      response.status < 400 &&
      location
    ) {
      if (redirectCount >= MAX_REDIRECTS) {
        throw new Error(
          "The website redirected too many times."
        );
      }

      const redirectedUrl = new URL(
        location,
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

async function websiteAllowsCrawler(pageUrl: URL) {
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
    /\.(jpg|jpeg|png|gif|webp|svg|ico|pdf|zip|mp3|wav|ogg|m4a|mp4|webm|mov|m4v|avi|css|js)$/i.test(
      pathname
    );

  return (
    (url.protocol === "https:" ||
      url.protocol === "http:") &&
    url.hostname === approvedHostname &&
    !blockedFile
  );
}

function createMediaUrl(
  value: string | undefined,
  pageUrl: string
) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (
    !trimmed ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("javascript:")
  ) {
    return null;
  }

  try {
    const url = new URL(trimmed, pageUrl);

    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:"
    ) {
      return null;
    }

    url.hash = "";

    return url.toString();
  } catch {
    return null;
  }
}

function collectImages(
  $: cheerio.CheerioAPI,
  pageUrl: string,
  pageTitle: string
) {
  const images: ImageCandidate[] = [];
  const seen = new Set<string>();

  function addImage(
    source: string | undefined,
    title = "",
    description = ""
  ) {
    if (images.length >= MAX_IMAGES_PER_PAGE) {
      return;
    }

    const imageUrl = createMediaUrl(
      source,
      pageUrl
    );

    if (!imageUrl || seen.has(imageUrl)) {
      return;
    }

    seen.add(imageUrl);

    const cleanTitle =
      cleanText(title) ||
      pageTitle ||
      "RayGo Image";

    images.push({
      url: imageUrl,
      title: cleanTitle.slice(0, 500),
      description: cleanText(
        description ||
          `Image from ${pageTitle}`
      ).slice(0, 1_000),
    });
  }

  addImage(
    $('meta[property="og:image"]').attr(
      "content"
    ),
    $('meta[property="og:image:alt"]').attr(
      "content"
    ) || pageTitle,
    `Image from ${pageTitle}`
  );

  addImage(
    $('meta[name="twitter:image"]').attr(
      "content"
    ),
    $('meta[name="twitter:image:alt"]').attr(
      "content"
    ) || pageTitle,
    `Image from ${pageTitle}`
  );

  $("img").each((_, element) => {
    if (images.length >= MAX_IMAGES_PER_PAGE) {
      return;
    }

    const image = $(element);

    const width = Number(
      image.attr("width") || "0"
    );

    const height = Number(
      image.attr("height") || "0"
    );

    if (
      (width > 0 && width < 100) ||
      (height > 0 && height < 100)
    ) {
      return;
    }

    const source =
      image.attr("src") ||
      image.attr("data-src") ||
      image.attr("data-lazy-src");

    const alt = cleanText(
      image.attr("alt") || ""
    );

    const imageTitle = cleanText(
      image.attr("title") || ""
    );

    addImage(
      source,
      alt || imageTitle || pageTitle,
      alt || `Image from ${pageTitle}`
    );
  });

  return images;
}

function collectVideos(
  $: cheerio.CheerioAPI,
  pageUrl: string,
  pageTitle: string,
  pageDescription: string
) {
  const videos: VideoCandidate[] = [];
  const seen = new Set<string>();

  function addVideo(
    source: string | undefined,
    title = "",
    description = ""
  ) {
    if (videos.length >= MAX_VIDEOS_PER_PAGE) {
      return;
    }

    const videoUrl = createMediaUrl(
      source,
      pageUrl
    );

    if (!videoUrl || seen.has(videoUrl)) {
      return;
    }

    seen.add(videoUrl);

    const cleanTitle =
      cleanText(title) ||
      pageTitle ||
      "RayGo Video";

    const cleanDescription =
      cleanText(description) ||
      pageDescription ||
      `Video from ${pageTitle}`;

    videos.push({
      url: videoUrl,
      title: cleanTitle.slice(0, 500),
      description:
        cleanDescription.slice(0, 1_000),
    });
  }

  const openGraphVideo =
    $('meta[property="og:video:secure_url"]').attr(
      "content"
    ) ||
    $('meta[property="og:video:url"]').attr(
      "content"
    ) ||
    $('meta[property="og:video"]').attr(
      "content"
    );

  addVideo(
    openGraphVideo,
    $('meta[property="og:title"]').attr(
      "content"
    ) || pageTitle,
    $('meta[property="og:description"]').attr(
      "content"
    ) || pageDescription
  );

  addVideo(
    $('meta[name="twitter:player:stream"]').attr(
      "content"
    ),
    $('meta[name="twitter:title"]').attr(
      "content"
    ) || pageTitle,
    $('meta[name="twitter:description"]').attr(
      "content"
    ) || pageDescription
  );

  $("video").each((_, element) => {
    if (videos.length >= MAX_VIDEOS_PER_PAGE) {
      return;
    }

    const video = $(element);

    const title =
      cleanText(
        video.attr("title") || ""
      ) || pageTitle;

    addVideo(
      video.attr("src"),
      title,
      pageDescription
    );

    video.find("source[src]").each(
      (_, sourceElement) => {
        addVideo(
          $(sourceElement).attr("src"),
          title,
          pageDescription
        );
      }
    );
  });

  $("source[src]").each((_, element) => {
    if (videos.length >= MAX_VIDEOS_PER_PAGE) {
      return;
    }

    const source = $(element);
    const type = (
      source.attr("type") || ""
    ).toLowerCase();

    const src = source.attr("src") || "";

    const looksLikeVideo =
      type.startsWith("video/") ||
      /\.(mp4|webm|mov|m4v)(\?|$)/i.test(src);

    if (looksLikeVideo) {
      addVideo(
        src,
        pageTitle,
        pageDescription
      );
    }
  });

  $("a[href]").each((_, element) => {
    if (videos.length >= MAX_VIDEOS_PER_PAGE) {
      return;
    }

    const link = $(element);
    const href = link.attr("href") || "";

    if (
      !/\.(mp4|webm|mov|m4v)(\?|$)/i.test(
        href
      )
    ) {
      return;
    }

    const linkText = cleanText(link.text());

    addVideo(
      href,
      linkText || pageTitle,
      pageDescription
    );
  });

  return videos;
}

export async function crawlWebsite(
  seedUrl: string
): Promise<CrawlResult> {
  const seed = await validatePublicUrl(seedUrl);

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
        parsedUrl.hostname !== approvedHostname
      ) {
        result.skipped.push(currentUrl);
        continue;
      }

      const allowed =
        await websiteAllowsCrawler(parsedUrl);

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
        response.headers.get("content-type") ||
        "";

      if (!contentType.includes("text/html")) {
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

      if (contentLength > MAX_CONTENT_BYTES) {
        result.skipped.push(
          `${currentUrl} (page is too large)`
        );
        continue;
      }

      const html = await response.text();

      if (
        Buffer.byteLength(html, "utf8") >
        MAX_CONTENT_BYTES
      ) {
        result.skipped.push(
          `${currentUrl} (page is too large)`
        );
        continue;
      }

      const $ = cheerio.load(html);

      const title =
        cleanText(
          $("title").first().text()
        ) || parsedUrl.hostname;

      const description = cleanText(
        $('meta[name="description"]').attr(
          "content"
        ) ||
          $('meta[property="og:description"]').attr(
            "content"
          ) ||
          ""
      );

      const images = collectImages(
        $,
        currentUrl,
        title
      );

      const videos = collectVideos(
        $,
        currentUrl,
        title,
        description
      );

      $(
        "script, style, noscript, svg, iframe"
      ).remove();

      const content = cleanText(
        $("body").text()
      ).slice(0, 100_000);

      await saveIndexedPage({
        url: currentUrl,
        hostname: parsedUrl.hostname,
        title: title.slice(0, 500),
        description:
          description.slice(0, 1_000),
        content,
        category: "web",
      });

      result.indexed.push(currentUrl);

      for (const image of images) {
        const imageHostname = new URL(
          image.url
        ).hostname;

        await saveIndexedPage({
          url: image.url,
          hostname: imageHostname,
          title: image.title,
          description: image.description,
          content: `${image.title} ${image.description} ${title}`,
          category: "images",
        });
      }

      for (const video of videos) {
        const videoHostname = new URL(
          video.url
        ).hostname;

        await saveIndexedPage({
          url: video.url,
          hostname: videoHostname,
          title: video.title,
          description: video.description,
          content: `${video.title} ${video.description} ${title}`,
          category: "videos",
        });
      }

      $("a[href]").each((_, element) => {
        if (
          queue.length + visited.size >=
          MAX_PAGES * 4
        ) {
          return;
        }

        const href = $(element).attr("href");

        if (!href) {
          return;
        }

        try {
          const discoveredUrl = new URL(
            href,
            currentUrl
          );

          discoveredUrl.hash = "";

          const discoveredString =
            discoveredUrl.toString();

          if (
            canCrawlLink(
              discoveredUrl,
              approvedHostname
            ) &&
            !visited.has(discoveredString) &&
            !queue.includes(discoveredString)
          ) {
            queue.push(discoveredString);
          }
        } catch {
          // Ignore invalid links.
        }
      });
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
