import express from "express";
import cors from "cors";
import router from "./routes/index.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug middleware
app.use((req: any, res: any, next: any) => {
  console.log(`[API] ${req.method} ${req.path}`);
  next();
});

app.use("/api", router);

// Error mapping for better visibility
app.use((err: any, req: any, res: any, next: any) => {
  console.error("[API Error]", err);
  res.status(500).json({ error: "Internal Server Error", message: String(err) });
});

export default app;
