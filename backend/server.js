const express = require("express");
const sql = require("mssql");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD.replace(/'/g, ""), // Remove quotes if present
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true,
    requestTimeout: 30000,
  },
};

// Connect to SQL Server
let pool;
sql
  .connect(config)
  .then((conn) => {
    pool = conn;
    console.log("Connected to Azure SQL Database");
  })
  .catch((err) => {
    console.error("Database connection failed:", err);
  });

// Health check endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    status: "API is running",
    message: "Welcome to EventHorizon API",
    endpoints: {
      events: "/events",
      createEvent: "POST /events",
      updateEvent: "PUT /events/:id",
      deleteEvent: "DELETE /events/:id",
    },
  });
});

// CREATE Event
app.post("/events", async (req, res) => {
  console.log("POST /events HIT");
  console.log("Request body:", req.body);
  try {
    const { name, date, location } = req.body;

    if (!name || !date || !location) {
      console.log("Missing fields");
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await pool
      .request()
      .input("name", sql.NVarChar(100), name)
      .input("date", sql.DateTime, new Date(date))
      .input("location", sql.NVarChar(100), location)
      .query(
        "INSERT INTO Events (name, date, location) OUTPUT INSERTED.* VALUES (@name, @date, @location)"
      );

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error("Error creating event:", err);
    res.status(500).json({ error: "Failed to create event" });
  }
});

// UPDATE Event
app.put("/events/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, date, location } = req.body;

    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .input("name", sql.NVarChar(100), name)
      .input("date", sql.DateTime, new Date(date))
      .input("location", sql.NVarChar(100), location).query(`
        UPDATE Events 
        SET name = @name, date = @date, location = @location 
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error("Error updating event:", err);
    res.status(500).json({ error: "Failed to update event" });
  }
});

// DELETE Event
app.delete("/events/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query("DELETE FROM Events OUTPUT DELETED.* WHERE id = @id");

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json({
      message: "Event deleted successfully",
      deletedEvent: result.recordset[0],
    });
  } catch (err) {
    console.error("Error deleting event:", err);
    res.status(500).json({ error: "Failed to delete event" });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Documentation: http://localhost:${PORT}`);
});

// Handle process termination
process.on("SIGTERM", () => {
  pool?.close();
  console.log("Server and database connection closed");
  process.exit(0);
});
