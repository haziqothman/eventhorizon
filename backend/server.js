/**
 * server.js — working Event Management API (Express + MSSQL)
 */

require("dotenv").config();
const express = require("express");
const sql = require("mssql");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8000;

console.log("🚀 Starting server.js");

// ✅ Middleware
app.use(cors());
app.use(express.json());

// ✅ MSSQL config
const dbConfig = {
  connectionString: process.env.DB_CONNECTION_STRING,
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

// ✅ Declare shared pool
let pool;

// ✅ Connect once on startup
async function connectDB() {
  try {
    pool = await sql.connect(dbConfig);
    console.log("✅ Connected to DB");
  } catch (err) {
    console.error("❌ DB connect failed:", err.message);
  }
}
connectDB();

// ✅ Health check
app.get("/api/ping", (req, res) => {
  res.send("pong");
});

// ✅ Get all events
app.get("/api/events", async (req, res) => {
  if (!pool) return res.status(500).json({ error: "DB not connected" });
  try {
    const result = await pool.request().query("SELECT * FROM Events");
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// ✅ Create event
app.post("/api/events", async (req, res) => {
  if (!pool) return res.status(500).json({ error: "DB not connected" });
  const { name, date, location } = req.body;
  if (!name || !date || !location) {
    return res.status(400).json({ error: "Missing fields" });
  }
  try {
    const result = await pool
      .request()
      .input("name", sql.NVarChar(100), name)
      .input("date", sql.DateTime, new Date(date))
      .input("location", sql.NVarChar(100), location)
      .query(
        `INSERT INTO Events (name, date, location)
         OUTPUT INSERTED.*
         VALUES (@name, @date, @location)`
      );
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Failed to create event", details: err.message });
  }
});

// ✅ Update event
app.put("/api/events/:id", async (req, res) => {
  if (!pool) return res.status(500).json({ error: "DB not connected" });
  const { id } = req.params;
  const { name, date, location } = req.body;
  if (!name || !date || !location) {
    return res.status(400).json({ error: "Missing fields" });
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
        `UPDATE Events
         SET name = @name, date = @date, location = @location
         OUTPUT INSERTED.*
         WHERE id = @id`
      );
    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Failed to update event", details: err.message });
  }
});

// ✅ Delete event
app.delete("/api/events/:id", async (req, res) => {
  if (!pool) return res.status(500).json({ error: "DB not connected" });
  const { id } = req.params;
  try {
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query(
        `DELETE FROM Events
         OUTPUT DELETED.*
         WHERE id = @id`
      );
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.json({ message: "Deleted", event: result.recordset[0] });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Failed to delete event", details: err.message });
  }
});

// ✅ For SPA frontend fallback (optional)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ✅ Start server — only once!
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
