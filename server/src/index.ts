import cors from "cors";
import express from "express";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors({ origin: ["http://localhost:5173", "http://127.0.0.1:5173"] }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "neonshift-station-api" });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
