import express from "express";
import cors from "cors";
import "./db.js"; // Initialize database and config directory on startup
import routes from "./routes/index.js";

const app = express();
const port = Number(process.env.PORT) || 23001;

app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
  });
  next();
});

app.use("/api", routes);

app.listen(port, () => {
  console.log(`tomu server listening on http://localhost:${port}`);
});
