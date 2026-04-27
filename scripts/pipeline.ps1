# Smart Attendance System - Big Data Pipeline Orchestrator
# ========================================================
# This script automates the flow from Database to Hadoop and Spark.

echo "--- STARTING DATA PIPELINE ---"

# 1. Export data from PostgreSQL to CSV
echo "[1/3] Exporting data from PostgreSQL..."
node scripts/export-data.cjs

# 2. Upload to HDFS in Docker
echo "[2/3] Uploading data to HDFS (Docker)..."
$CSV_PATH = "data/attendance_export.csv"
if (Test-Path $CSV_PATH) {
    # Create directory in HDFS
    docker exec namenode hdfs dfs -mkdir -p /attendance/input
    
    # Upload file (copying it into the container first to avoid path issues)
    docker cp $CSV_PATH namenode:/tmp/attendance_export.csv
    docker exec namenode hdfs dfs -put -f /tmp/attendance_export.csv /attendance/input/
    echo "Successfully uploaded to HDFS: /attendance/input/attendance_export.csv"
} else {
    echo "ERROR: Export file not found at $CSV_PATH"
    exit 1
}

# 3. Run Spark Analytics
echo "[3/3] Running Spark Analytics..."
# Ensure dependencies are installed
# pip install -r scripts/spark-requirements.txt

python scripts/spark_analytics.py --mode spark --hdfs-host localhost --hdfs-port 9000 --input hdfs://localhost:9000/attendance/input/attendance_export.csv --output data/spark_results

echo "--- PIPELINE COMPLETE ---"
echo "Results available in: data/spark_results"
