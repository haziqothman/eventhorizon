require("dotenv").config();
const express = require("express");
const path = require("path");
const sql = require("mssql");
const cors = require("cors");
const app = express();

// ✅ MSSQL config
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

let pool;

async function connectDB() {
  try {
    pool = await sql.connect(config);
    console.log("✅ Connected to SQL Server");
  } catch (err) {
    console.error("❌ DB Connection failed:", err);
    setTimeout(connectDB, 5000);
  }
}
connectDB();

// ✅ Middleware (MUST COME BEFORE ROUTES)
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ✅ Serve static files from React app
app.use(express.static(path.join(__dirname, "public")));

// ✅ API routes
app.get("/api/events", async (req, res) => {
  try {
    const result = await pool.request().query("SELECT * FROM Events");
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

app.post("/api/events", async (req, res) => {
  try {
    console.log("BODY:", req.body);
    const { name, date, location } = req.body;

    const result = await pool
      .request()
      .input("name", sql.NVarChar(100), name)
      .input("date", sql.DateTime, new Date(date))
      .input("location", sql.NVarChar(100), location)
      .query(
        `INSERT INTO Events (name, date, location) OUTPUT INSERTED.* VALUES (@name, @date, @location)`
      );

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error("POST /events error:", err);
    res
      .status(500)
      .json({ error: "Failed to create event", details: err.message });
  }
});

app.put("/api/events/:id", async (req, res) => {
  const { id } = req.params;
  const { name, date, location } = req.body || {};
  if (!name || !date || !location) {
    return res.status(400).json({ error: "Missing fields", body: req.body });
  }

  try {
    const exists = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT 1 FROM Events WHERE id = @id");
    if (exists.recordset.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .input("name", sql.NVarChar(100), name)
      .input("date", sql.DateTime, new Date(date))
      .input("location", sql.NVarChar(100), location)
      .query(
        "UPDATE Events SET name = @name, date = @date, location = @location OUTPUT INSERTED.* WHERE id = @id"
      );

    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Failed to update event", details: err.message });
  }
});

app.delete("/api/events/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query("DELETE FROM Events OUTPUT DELETED.* WHERE id = @id");
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.json({ message: "Deleted", event: result.recordset[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete event" });
  }
});

// ✅ Handle client-side routing (MUST BE LAST)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ✅ Server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
