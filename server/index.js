import express from "express";
import cors from "cors";
import axios from "axios";
import { WebSocketServer } from "ws";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

// -----------------------------
// HTTP API for normal requests
// -----------------------------
app.post("/chat", async (req, res) => {
    const userMessage = req.body.message;

    try {
        const response = await axios.post("http://localhost:11434/api/generate", {
            model: "phi3:mini",
            prompt: userMessage,
            stream: false
        });

        return res.json({
            reply: response.data.response
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Ollama request failed" });
    }
});

// -----------------------------
// WebSocket for 3D Avatar sync
// -----------------------------
const wss = new WebSocketServer({ port: 3002 });

wss.on("connection", (ws) => {
    console.log("Frontend connected to WS avatar server.");

    ws.on("message", async (msg) => {
        const text = msg.toString();

        // Ask Ollama
        const response = await axios.post(
            "http://localhost:11434/api/generate",
            { model: "phi3:mini", prompt: text, stream: false }
        );

        // Send message to avatar frontend
        ws.send(JSON.stringify({
            type: "avatar_speech",
            text: response.data.response
        }));
    });
});


console.log("WebSocket server running on ws://localhost:3002");


// Start HTTP
app.listen(PORT, () => {
    console.log(`HTTP API running on http://localhost:${PORT}`);
});
