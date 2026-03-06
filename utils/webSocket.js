const WebSocket = require("ws");
const http = require("http");
let wss;

function setupWebSocketServer() {
  const server = http.createServer();
  wss = new WebSocket.Server({ server });

  wss.on("connection", (ws) => {
    console.log("Client connected");
    ws.on("close", () => {
      console.log("Client disconnected");
    });
  });

  server.listen(8080, () => {
    console.log("Server is listening on http://localhost:8080");
  });
}

function broadcast(message) {
  if (wss) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}

// Setup the WebSocket server when this module is imported
setupWebSocketServer();

module.exports = { broadcast };
