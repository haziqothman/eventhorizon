import React, { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";

const API_URL = "http://localhost:8000/api";

function EventManagement() {
  const [events, setEvents] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    date: "",
    location: "",
  });
  const [attendees, setAttendees] = useState([]);
  const [attendeeForm, setAttendeeForm] = useState({
    name: "",
    email: "",
    eventId: "",
  });
  const [view, setView] = useState("admin");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchAttendees = async (eventId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/events/${eventId}/attendees`);
      if (!response.ok) throw new Error("Failed to fetch attendees");
      const data = await response.json();
      setAttendees(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAttendeeInputChange = (e) => {
    const { name, value } = e.target;
    setAttendeeForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const url = editingId
        ? `${API_URL}/events/${editingId}`
        : `${API_URL}/events`;
      const method = editingId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          date: formData.date,
          location: formData.location.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Request failed");
      }

      const result = await response.json();
      setSuccess(
        editingId
          ? "Event updated successfully!"
          : "Event created successfully!"
      );
      setFormData({ name: "", date: "", location: "" });
      setEditingId(null);
      await fetchEvents();
    } catch (err) {
      console.error("Submission error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
      setTimeout(() => setSuccess(""), 3000);
    }
  };

  const handleAttendeeSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_URL}/attendees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: attendeeForm.name,
          email: attendeeForm.email,
          eventId: selectedEvent.id,
        }),
      });

      // Handle non-JSON responses
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(text || "Server returned invalid response");
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Registration failed");
      }

      setSuccess("Registered successfully!");
      setAttendeeForm({ name: "", email: "", eventId: "" });
      fetchAttendees(selectedEvent.id);
    } catch (err) {
      console.error("Registration error:", err);
      setError(
        err.message.includes("Cannot POST")
          ? "Server endpoint not configured properly"
          : err.message
      );
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
    window.scrollTo(0, 0);
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

      const result = await response.json();
      setSuccess("Event deleted successfully!");
      await fetchEvents();
    } catch (err) {
      console.error("Delete error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
      setTimeout(() => setSuccess(""), 3000);
    }
  };

  const handleViewEvent = (event) => {
    setSelectedEvent(event);
    fetchAttendees(event.id);
  };

  return (
    <div className="event-management">
      <div className="view-toggle">
        <button
          onClick={() => setView("admin")}
          className={view === "admin" ? "active" : ""}
        >
          Admin View
        </button>
        <button
          onClick={() => setView("attendee")}
          className={view === "attendee" ? "active" : ""}
        >
          Attendee View
        </button>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {view === "admin" ? (
        <>
          <h1>Event Management (Admin)</h1>

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
              <p>No events found</p>
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
                      <td className="actions">
                        <button
                          onClick={() => handleEdit(event)}
                          disabled={loading}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(event.id)}
                          disabled={loading}
                          className="delete"
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
        </>
      ) : (
        <>
          <h1>Event Registration (Attendee)</h1>

          {selectedEvent ? (
            <div className="event-details">
              <h2>{selectedEvent.name}</h2>
              <p>Date: {format(parseISO(selectedEvent.date), "PPpp")}</p>
              <p>Location: {selectedEvent.location}</p>

              <h3>Register for this event</h3>
              <form onSubmit={handleAttendeeSubmit}>
                <div className="form-group">
                  <label>Your Name:</label>
                  <input
                    type="text"
                    name="name"
                    value={attendeeForm.name}
                    onChange={handleAttendeeInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email:</label>
                  <input
                    type="email"
                    name="email"
                    value={attendeeForm.email}
                    onChange={handleAttendeeInputChange}
                    required
                  />
                </div>
                <input type="hidden" name="eventId" value={selectedEvent.id} />
                <button type="submit" disabled={loading}>
                  {loading ? "Registering..." : "Register"}
                </button>
              </form>

              <h3>Attendees ({attendees.length})</h3>
              <ul className="attendees-list">
                {attendees.map((attendee) => (
                  <li key={attendee.id}>
                    {attendee.name} ({attendee.email})
                  </li>
                ))}
              </ul>

              <button onClick={() => setSelectedEvent(null)}>
                Back to Events
              </button>
            </div>
          ) : (
            <div className="events-list">
              <h2>Available Events</h2>
              {events.map((event) => (
                <div key={event.id} className="event-card">
                  <h3>{event.name}</h3>
                  <p>Date: {format(parseISO(event.date), "PPpp")}</p>
                  <p>Location: {event.location}</p>
                  <button onClick={() => handleViewEvent(event)}>
                    View Details
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default EventManagement;
