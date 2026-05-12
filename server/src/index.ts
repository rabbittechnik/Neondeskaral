import cors from "cors";
import express from "express";

const app = express();
const PORT = Number(process.env.PORT) || 4000;
/** Railway/Docker: nur 0.0.0.0 ist von außen erreichbar (nicht 127.0.0.1). */
const HOST = process.env.HOST || "0.0.0.0";

app.use(cors({ origin: ["http://localhost:5173", "http://127.0.0.1:5173"] }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "neonshift-station-api" });
});

app.listen(PORT, HOST, () => {
  console.log(`API listening on http://${HOST}:${PORT}`);
});
