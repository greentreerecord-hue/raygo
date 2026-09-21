import postgres from "postgres";

const connectionString =
  process.env.RAYGO_MAIL_DB_DATABASE_URL;

function getDatabase() {
  if (!connectionString) {
    throw new Error(
      "RAYGO_MAIL_DB_DATABASE_URL is missing"
    );
  }

  return postgres(connectionString, {
    ssl: "require",
    max: 1,
    prepare: false,
  });
}

export type IndexedPage = {
  url: string;
  hostname: string;
  title: string;
  description: string;
  content: string;
  category?: string;
  publishedAt?: string | null;
};

export async function ensureCrawlerTable() {
  const sql = getDatabase();

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS raygo_indexed_pages (
        url TEXT PRIMARY KEY,
        hostname TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT 'web',
        published_at TIMESTAMPTZ,
        indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      ALTER TABLE raygo_indexed_pages
      ADD COLUMN IF NOT EXISTS category TEXT
      NOT NULL DEFAULT 'web'
    `;

    await sql`
      ALTER TABLE raygo_indexed_pages
      ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS raygo_indexed_pages_hostname_idx
      ON raygo_indexed_pages (hostname)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS raygo_indexed_pages_category_idx
      ON raygo_indexed_pages (category)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS raygo_indexed_pages_published_idx
      ON raygo_indexed_pages (published_at DESC)
    `;
  } finally {
    await sql.end();
  }
}

export async function saveIndexedPage(
  page: IndexedPage
) {
  const sql = getDatabase();
  const category = page.category || "web";
  const publishedAt = page.publishedAt || null;

  try {
    await ensureCrawlerTable();

    await sql`
      INSERT INTO raygo_indexed_pages (
        url,
        hostname,
        title,
        description,
        content,
        category,
        published_at,
        indexed_at
      )
      VALUES (
        ${page.url},
        ${page.hostname},
        ${page.title},
        ${page.description},
        ${page.content},
        ${category},
        ${publishedAt},
        NOW()
      )
      ON CONFLICT (url)
      DO UPDATE SET
        hostname = EXCLUDED.hostname,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        content = EXCLUDED.content,
        category = EXCLUDED.category,
        published_at = EXCLUDED.published_at,
        indexed_at = NOW()
    `;
  } finally {
    await sql.end();
  }
}

export async function searchIndexedPages(
  searchText: string,
  category?: string
) {
  const query = searchText.trim();

  if (!query) {
    return [];
  }

  const sql = getDatabase();
  const pattern = `%${query}%`;

  try {
    await ensureCrawlerTable();

    if (category) {
      return await sql`
        SELECT
          url,
          hostname,
          title,
          description,
          category,
          published_at,
          indexed_at
        FROM raygo_indexed_pages
        WHERE category = ${category}
          AND (
            title ILIKE ${pattern}
            OR description ILIKE ${pattern}
            OR content ILIKE ${pattern}
          )
        ORDER BY
          CASE
            WHEN title ILIKE ${pattern} THEN 1
            WHEN description ILIKE ${pattern} THEN 2
            ELSE 3
          END,
          published_at DESC NULLS LAST,
          indexed_at DESC
        LIMIT 25
      `;
    }

    return await sql`
      SELECT
        url,
        hostname,
        title,
        description,
        category,
        published_at,
        indexed_at
      FROM raygo_indexed_pages
      WHERE
        title ILIKE ${pattern}
        OR description ILIKE ${pattern}
        OR content ILIKE ${pattern}
      ORDER BY
        CASE
          WHEN title ILIKE ${pattern} THEN 1
          WHEN description ILIKE ${pattern} THEN 2
          ELSE 3
        END,
        published_at DESC NULLS LAST,
        indexed_at DESC
      LIMIT 25
    `;
  } finally {
    await sql.end();
  }
} 
export async function getLatestCategoryPages(
  category: string
) {
  const sql = getDatabase();

  try {
    await ensureCrawlerTable();

    return await sql`
      SELECT
        url,
        hostname,
        title,
        description,
        category,
        published_at,
        indexed_at
      FROM raygo_indexed_pages
      WHERE category = ${category}
      ORDER BY
        published_at DESC NULLS LAST,
        indexed_at DESC
      LIMIT 25
    `;
  } finally {
    await sql.end();
  }
} 
