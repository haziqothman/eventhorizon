/**
 * server.js — fully working Event Management API with Express + MSSQL
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const sql = require("mssql");
const path = require("path");

const app = express(); // ✅ Create app BEFORE you use it
const PORT = process.env.PORT || 8000;

app.use(
  cors({
    origin: "http://localhost:8001",
    credentials: true,
  })
);

// ✅ JSON parser
app.use(express.json());

// ✅ Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ✅ Static files
app.use(express.static(path.join(__dirname, "public")));

// ✅ DB config & connection
const dbConfig = {
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
    pool = await sql.connect(dbConfig);
    console.log("✅ Connected to SQL Server");
  } catch (err) {
    console.error("❌ DB Connection failed:", err);
    setTimeout(connectDB, 5000);
  }
}
connectDB();

// ✅ Event CRUD routes — all under /api
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
        `INSERT INTO Events (name, date, location) OUTPUT INSERTED.* VALUES (@name, @date, @location)`
      );
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Failed to create event", details: err.message });
  }
});

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
  if (!pool) return res.status(500).json({ error: "DB not connected" });
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

// ✅ Attendee CRUD operations — must come BEFORE the catch-all

app.get("/api/attendees", async (req, res) => {
  if (!pool) return res.status(500).json({ error: "DB not connected" });
  try {
    const result = await pool.request().query("SELECT * FROM Attendees");
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch attendees" });
  }
});

app.post("/api/attendees", async (req, res) => {
  if (!pool) return res.status(500).json({ error: "Database not connected" });

  const { name, email, eventId } = req.body;

  if (!name || !email || !eventId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const eventExists = await pool
      .request()
      .input("eventId", sql.Int, eventId)
      .query("SELECT 1 FROM Events WHERE id = @eventId");

    if (!eventExists.recordset.length) {
      return res.status(404).json({ error: "Event not found" });
    }

    const result = await pool
      .request()
      .input("name", sql.NVarChar(100), name)
      .input("email", sql.NVarChar(100), email)
      .input("event_id", sql.Int, eventId)
      .query(
        `INSERT INTO Attendees (name, email, event_id)
         OUTPUT INSERTED.*
         VALUES (@name, @email, @event_id)`
      );

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: "Failed to register attendee" });
  }
});

app.get("/api/events/:id/attendees", async (req, res) => {
  if (!pool) return res.status(500).json({ error: "DB not connected" });
  const { id } = req.params;
  try {
    const result = await pool
      .request()
      .input("eventId", sql.Int, id)
      .query("SELECT * FROM Attendees WHERE event_id = @eventId");
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch attendees" });
  }
});

// ✅ SPA frontend catch-all — always last
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
