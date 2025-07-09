import React, { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";

const API_URL =
  "https://eventhorizon-eufth7a5ambghxef.malaysiawest-01.azurewebsites.net/api";

function EventManagement() {
  const [events, setEvents] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    date: "",
    location: "",
  });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchEvents = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/events`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setEvents(data);
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Failed to load events: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const url = editingId
        ? `${API_URL}/events/${editingId}`
        : `${API_URL}/events`;
      const method = editingId ? "PUT" : "POST";

      // Prepare payload with proper date formatting
      const payload = {
        name: formData.name.trim(),
        date: new Date(formData.date).toISOString(),
        location: formData.location.trim(),
      };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Request failed");
      }

      // Reset form and refresh list
      setFormData({ name: "", date: "", location: "" });
      setEditingId(null);
      await fetchEvents();
    } catch (err) {
      console.error("Submission error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (event) => {
    setFormData({
      name: event.name,
      date: format(parseISO(event.date), "yyyy-MM-dd'T'HH:mm"),
      location: event.location,
    });
    setEditingId(event.id);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this event?")) return;

    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/events/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Delete failed");
      }

      await fetchEvents();
    } catch (err) {
      console.error("Delete error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="event-management">
      <h1>Event Management</h1>

      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <h2>{editingId ? "Edit Event" : "Create Event"}</h2>

        <div className="form-group">
          <label>Event Name:</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            minLength="2"
          />
        </div>

        <div className="form-group">
          <label>Date:</label>
          <input
            type="datetime-local"
            name="date"
            value={formData.date}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Location:</label>
          <input
            type="text"
            name="location"
            value={formData.location}
            onChange={handleInputChange}
            required
            minLength="2"
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading
            ? "Processing..."
            : editingId
            ? "Update Event"
            : "Create Event"}
        </button>

        {editingId && (
          <button
            type="button"
            onClick={() => {
              setFormData({ name: "", date: "", location: "" });
              setEditingId(null);
            }}
            disabled={loading}
          >
            Cancel
          </button>
        )}
      </form>

      <div className="events-list">
        <h2>Upcoming Events</h2>
        {loading && !events.length ? (
          <p>Loading events...</p>
        ) : events.length === 0 ? (
          <p>No events scheduled</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Date</th>
                <th>Location</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{event.name}</td>
                  <td>{format(parseISO(event.date), "PPpp")}</td>
                  <td>{event.location}</td>
                  <td>
                    <button
                      onClick={() => handleEdit(event)}
                      disabled={loading}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(event.id)}
                      disabled={loading}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default EventManagement;
