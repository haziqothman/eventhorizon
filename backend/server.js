require("dotenv").config();
const express = require("express");
const sql = require("mssql");
const cors = require("cors");

const app = express();

// Enhanced CORS configuration
const allowedOrigins = [
  "http://localhost:3000",
  "https://eventhorizon-eufth7a5ambghxef.azurewebsites.net",
  "https://www.getpostman.com", // Add Postman's web origin if using web version
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
// Database configuration with connection pooling
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD.replace(/'/g, ""),
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true,
    requestTimeout: 30000,
  },
};

// Database connection with connection pool
let pool;
const connectToDatabase = async () => {
  try {
    pool = await sql.connect(config);
    console.log("Connected to Azure SQL Database");

    // Test the connection
    await pool.request().query("SELECT 1");
  } catch (err) {
    console.error("Database connection failed:", err);
    // Retry connection after 5 seconds
    setTimeout(connectToDatabase, 8000);
  }
};

connectToDatabase();

// Health check endpoint with database status
app.get("/", async (req, res) => {
  try {
    const dbStatus = pool.connected ? "connected" : "disconnected";

    res.status(200).json({
      status: "API is running",
      database: dbStatus,
      message: "Welcome to EventHorizon API",
      endpoints: {
        events: {
          getAll: "GET /events",
          create: "POST /events",
          update: "PUT /events/:id",
          delete: "DELETE /events/:id",
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      status: "API is running",
      database: "connection error",
      error: err.message,
    });
  }
});

// GET all events
app.get("/events", async (req, res) => {
  try {
    const result = await pool
      .request()
      .query("SELECT * FROM Events ORDER BY date DESC");
    res.json(result.recordset);
  } catch (err) {
    console.error("Error fetching events:", err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// CREATE Event with validation
app.post("/events", async (req, res) => {
  try {
    const { name, date, location } = req.body;

    // Validate input
    if (!name || !date || !location) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["name", "date", "location"],
      });
    }

    // Validate date format
    if (isNaN(new Date(date).getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    const result = await pool
      .request()
      .input("name", sql.NVarChar(100), name.trim())
      .input("date", sql.DateTime, new Date(date))
      .input("location", sql.NVarChar(100), location.trim()).query(`
        INSERT INTO Events (name, date, location) 
        OUTPUT INSERTED.* 
        VALUES (@name, @date, @location)
      `);

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error("Error creating event:", err);
    res.status(500).json({
      error: "Failed to create event",
      details: err.message,
    });
  }
});

// UPDATE Event with existence check
app.put("/events/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, date, location } = req.body;

    // Check if event exists first
    const checkResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT 1 FROM Events WHERE id = @id");

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .input("name", sql.NVarChar(100), name?.trim())
      .input("date", sql.DateTime, date ? new Date(date) : null)
      .input("location", sql.NVarChar(100), location?.trim()).query(`
        UPDATE Events 
        SET 
          name = COALESCE(@name, name),
          date = COALESCE(@date, date),
          location = COALESCE(@location, location)
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    res.json(result.recordset[0]);
  } catch (err) {
    console.error("Error updating event:", err);
    res.status(500).json({
      error: "Failed to update event",
      details: err.message,
    });
  }
});

// DELETE Event with confirmation
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
    res.status(500).json({
      error: "Failed to delete event",
      details: err.message,
    });
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  if (err instanceof sql.RequestError) {
    return res.status(503).json({
      error: "Database service unavailable",
      details: err.message,
    });
  }

  res.status(500).json({
    error: "Internal server error",
    details: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Start server
const PORT = process.env.PORT || 8000;
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Documentation: http://localhost:${PORT}`);
});

// Handle process termination
const shutdown = async () => {
  console.log("Shutting down server...");

  try {
    await pool?.close();
    console.log("Database connection closed");
  } catch (err) {
    console.error("Error closing database connection:", err);
  }

  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
