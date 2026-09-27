import postgres from "postgres";

const connectionCandidates = [
  process.env.RAYGO_MAIL_DB_POSTGRES_URL,
  process.env
    .RAYGO_MAIL_DB_POSTGRES_URL_NON_POOLING,
  process.env.RAYGO_MAIL_DB_DATABASE_URL,
];

const connectionString =
  connectionCandidates.find(
    (value) =>
      value?.startsWith("postgres://") ||
      value?.startsWith("postgresql://")
  );

function getDatabase() {
  if (!connectionString) {
    throw new Error(
      "No valid RayGo Postgres connection URL was found"
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
      CREATE INDEX IF NOT EXISTS
      raygo_indexed_pages_hostname_idx
      ON raygo_indexed_pages (hostname)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS
      raygo_indexed_pages_category_idx
      ON raygo_indexed_pages (category)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS
      raygo_indexed_pages_published_idx
      ON raygo_indexed_pages (published_at DESC)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS
      raygo_indexed_pages_search_idx
      ON raygo_indexed_pages
      USING GIN (
        to_tsvector(
          'simple',
          COALESCE(title, '') || ' ' ||
          COALESCE(description, '') || ' ' ||
          COALESCE(content, '')
        )
      )
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
  const containsPattern = `%${query}%`;
  const startsPattern = `${query}%`;

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
            title ILIKE ${containsPattern}
            OR description ILIKE ${containsPattern}
            OR content ILIKE ${containsPattern}
            OR hostname ILIKE ${containsPattern}
            OR to_tsvector(
              'simple',
              COALESCE(title, '') || ' ' ||
              COALESCE(description, '') || ' ' ||
              COALESCE(content, '')
            ) @@ plainto_tsquery('simple', ${query})
          )
        ORDER BY
          CASE
            WHEN LOWER(title) = LOWER(${query}) THEN 1
            WHEN title ILIKE ${startsPattern} THEN 2
            WHEN title ILIKE ${containsPattern} THEN 3
            WHEN hostname ILIKE ${containsPattern} THEN 4
            WHEN description ILIKE ${containsPattern} THEN 5
            ELSE 6
          END,
          ts_rank_cd(
            setweight(
              to_tsvector(
                'simple',
                COALESCE(title, '')
              ),
              'A'
            ) ||
            setweight(
              to_tsvector(
                'simple',
                COALESCE(description, '')
              ),
              'B'
            ) ||
            setweight(
              to_tsvector(
                'simple',
                COALESCE(content, '')
              ),
              'C'
            ),
            plainto_tsquery('simple', ${query})
          ) DESC,
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
        title ILIKE ${containsPattern}
        OR description ILIKE ${containsPattern}
        OR content ILIKE ${containsPattern}
        OR hostname ILIKE ${containsPattern}
        OR to_tsvector(
          'simple',
          COALESCE(title, '') || ' ' ||
          COALESCE(description, '') || ' ' ||
          COALESCE(content, '')
        ) @@ plainto_tsquery('simple', ${query})
      ORDER BY
        CASE
          WHEN LOWER(title) = LOWER(${query}) THEN 1
          WHEN title ILIKE ${startsPattern} THEN 2
          WHEN title ILIKE ${containsPattern} THEN 3
          WHEN hostname ILIKE ${containsPattern} THEN 4
          WHEN description ILIKE ${containsPattern} THEN 5
          ELSE 6
        END,
        ts_rank_cd(
          setweight(
            to_tsvector(
              'simple',
              COALESCE(title, '')
            ),
            'A'
          ) ||
          setweight(
            to_tsvector(
              'simple',
              COALESCE(description, '')
            ),
            'B'
          ) ||
          setweight(
            to_tsvector(
              'simple',
              COALESCE(content, '')
            ),
            'C'
          ),
          plainto_tsquery('simple', ${query})
        ) DESC,
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
