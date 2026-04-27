import pool from "@/lib/db.js";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

export async function GET() {
  const status = {
    database: { status: "unknown", message: "" },
    faceRecognition: { status: "unknown", message: "" },
    spark: { status: "unknown", message: "" },
    hadoop: { status: "unknown", message: "" },
  };

  // 1. Check Database (AWS RDS)
  try {
    const start = Date.now();
    const result = await pool.query("SELECT NOW() as time");
    const latency = Date.now() - start;
    status.database = {
      status: "connected",
      message: `Connected to Student-DB on AWS RDS. Latency: ${latency}ms`,
      serverTime: result.rows[0].time,
    };
  } catch (err) {
    status.database = { status: "error", message: err.message };
  }

  // 2. Check Face Recognition Service (YOLO)
  try {
    const serviceUrl = process.env.FACE_RECOGNITION_SERVICE_URL || "http://127.0.0.1:8000";
    const start = Date.now();
    const response = await fetch(`${serviceUrl}/health`, { signal: AbortSignal.timeout(3000) });
    const latency = Date.now() - start;
    
    if (response.ok) {
      const data = await response.json();
      status.faceRecognition = {
        status: "connected",
        message: `YOLO Service is active. Latency: ${latency}ms`,
        details: data,
      };
    } else {
      status.faceRecognition = { status: "error", message: `Service returned ${response.status}` };
    }
  } catch (err) {
    status.faceRecognition = { 
      status: "offline", 
      message: "YOLO service is not running. System will use local face-api.js fallback." 
    };
  }

  // 3. Check Spark (via CLI)
  try {
    const { stdout, stderr } = await execPromise("spark-submit --version");
    status.spark = {
      status: "installed",
      message: "Apache Spark is available on the system path.",
      versionInfo: stdout || stderr,
    };
  } catch (err) {
    status.spark = { 
      status: "not_found", 
      message: "Apache Spark is not installed or not in the system PATH." 
    };
  }

  // 4. Check Hadoop (via CLI or Docker)
  try {
    // Try local command first
    const { stdout } = await execPromise("hadoop version");
    status.hadoop = {
      status: "installed",
      message: "Hadoop is available on the system path.",
      versionInfo: stdout,
    };
  } catch (err) {
    // If local command fails, check if Docker container is running or WebUI is reachable
    try {
      const response = await fetch("http://localhost:9870", { signal: AbortSignal.timeout(2000) });
      if (response.ok) {
        status.hadoop = {
          status: "connected",
          message: "Connected to Hadoop NameNode (Docker).",
          uiUrl: "http://localhost:9870",
        };
      } else {
        throw new Error("UI unreachable");
      }
    } catch (dockerErr) {
      status.hadoop = { 
        status: "not_found", 
        message: "Hadoop is not installed locally or its Docker container is offline." 
      };
    }
  }

  return Response.json(status);
}
