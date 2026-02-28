import express from "express";
import pg from "pg";

const app = express();
const port = process.env.PORT || 8080;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("Missing DATABASE_URL env var");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl });

app.get("/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT 1 as ok");
    res.json({ status: "ok", db: result.rows[0].ok === 1 });
  } catch (e) {
    res.status(500).json({ status: "error", message: e.message });
  }
});

app.listen(port, () => {
  console.log(`Backend listening on :${port}`);
});