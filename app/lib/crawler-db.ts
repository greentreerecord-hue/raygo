import postgres from "postgres";

const connectionString = process.env.RAYGO_MAIL_DB_DATABASE_URL;

function getDatabase() {
  if (!connectionString) {
    throw new Error("RAYGO_MAIL_DB_DATABASE_URL is missing");
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
        indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS raygo_indexed_pages_hostname_idx
      ON raygo_indexed_pages (hostname)
    `;
  } finally {
    await sql.end();
  }
}

export async function saveIndexedPage(page: IndexedPage) {
  const sql = getDatabase();

  try {
    await ensureCrawlerTable();

    await sql`
      INSERT INTO raygo_indexed_pages (
        url,
        hostname,
        title,
        description,
        content,
        indexed_at
      )
      VALUES (
        ${page.url},
        ${page.hostname},
        ${page.title},
        ${page.description},
        ${page.content},
        NOW()
      )
      ON CONFLICT (url)
      DO UPDATE SET
        hostname = EXCLUDED.hostname,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        content = EXCLUDED.content,
        indexed_at = NOW()
    `;
  } finally {
    await sql.end();
  }
}

export async function searchIndexedPages(searchText: string) {
  const query = searchText.trim();

  if (!query) {
    return [];
  }

  const sql = getDatabase();
  const pattern = `%${query}%`;

  try {
    await ensureCrawlerTable();

    return await sql`
      SELECT
        url,
        hostname,
        title,
        description,
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
        indexed_at DESC
      LIMIT 25
    `;
  } finally {
    await sql.end();
  }
} 
