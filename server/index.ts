import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import { router } from "./routes.js";
import { requireAppPassword } from "./auth.js";

try {
  process.loadEnvFile();
} catch {
  // no .env file present — fall back to whatever is already in process.env
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Railway (and most PaaS hosts) sit behind one reverse proxy hop; trusting it
// makes req.ip reflect the real client IP from X-Forwarded-For instead of the
// proxy's own address, which the login rate-limiter in auth.ts depends on.
app.set("trust proxy", 1);

app.use(requireAppPassword);
app.use(express.json());
app.use("/api", router);

if (process.env.NODE_ENV === "production") {
  const distDir = path.join(__dirname, "..", "dist");
  app.use(express.static(distDir));
  app.get("*", (_req, res) => res.sendFile(path.join(distDir, "index.html")));
}

// In production this process serves both the API and the built frontend, so it
// should bind to whatever port the host assigns via PORT. In dev, Vite's own
// dev server owns PORT (see launch.json/.env "PORT"); the API instead uses
// API_PORT so the two processes never race for the same port.
const port = process.env.NODE_ENV === "production"
  ? Number(process.env.PORT) || 3001
  : Number(process.env.API_PORT) || 3001;

app.listen(port, () => {
  console.log(`Life Work OS server listening on http://localhost:${port}`);
});
