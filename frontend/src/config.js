// In your React app (src/config.js)
export const API_BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://eventhorizon-eufth7a5ambghxef.malaysiawest-01.azurewebsites.net"
    : "http://localhost:8000";
