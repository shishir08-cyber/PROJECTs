const { Pool } = require("pg");

// ── Supabase / any PostgreSQL connection ──
// Set DATABASE_URL in your .env file
// For Supabase: Project Settings → Database → Connection string → URI
// Format: postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }, // required for Supabase
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      }
    : {
        user:     process.env.DB_USER     || "postgres",
        host:     process.env.DB_HOST     || "localhost",
        database: process.env.DB_NAME     || "nova_store",
        password: process.env.DB_PASSWORD || "",
        port:     parseInt(process.env.DB_PORT) || 5432,
        ssl:      false,
        max: 10,
      }
);

pool.connect((err, client, done) => {
  if (err) {
    console.error("❌ DB connection failed:", err.message);
    console.error("   → Check DATABASE_URL in your .env file");
  } else {
    console.log("✅ Database connected");
    done();
  }
});

module.exports = pool;
