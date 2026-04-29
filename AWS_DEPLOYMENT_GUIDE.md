# ☁️ AWS Deployment Guide: Smart Attendance System

This document outlines the professional deployment strategy for the **AI-Powered Attendance Tracking System** with Hadoop/Spark integration.

## 🏗️ Architecture Overview

The system is designed for high-density student recognition (80+ students) using a hybrid cloud architecture.

| Component | AWS Service | Recommendation |
| :--- | :--- | :--- |
| **Frontend/API** | **AWS Amplify** | Automatic CI/CD from GitHub |
| **AI Inference** | **Amazon EC2** | `g4dn.xlarge` (NVIDIA T4 GPU) |
| **Database** | **Amazon RDS** | PostgreSQL 15+ |
| **Big Data** | **Amazon EMR** | Spark 3.4 & Hadoop 3.3 |
| **Storage** | **Amazon S3** | Video storage & Data Warehouse |

---

## 🚀 Phase 1: AI Inference Service (EC2)

The Python service (YOLOv8 + ArcFace) is the core engine. For real-time performance in a crowded classroom, GPU acceleration is required.

### 1. Launch Instance
1. Go to EC2 Dashboard -> Launch Instance.
2. **AMI**: Ubuntu Server 22.04 LTS.
3. **Instance Type**: `g4dn.xlarge` (for GPU) or `c6i.2xlarge` (for high CPU).
4. **Security Group**: Allow TCP Port `8000` (FastAPI) and `22` (SSH).

### 2. Configure Environment
Connect via SSH and run:
```bash
# Install Docker & NVIDIA Container Toolkit
sudo apt update && sudo apt install -y docker.io

# Install Python dependencies
pip install fastapi uvicorn ultralytics insightface onnxruntime-gpu opencv-python
```

### 3. Start Service
```bash
python3 -m uvicorn scripts.face_recognition_service:app --host 0.0.0.0 --port 8000
```

---

## 📦 Phase 2: Next.js Web App (AWS Amplify)

1. **Connect Repository**: Link your GitHub repo to AWS Amplify.
2. **Build Settings**:
   *   Framework: Next.js
   *   Build Command: `npm run build`
3. **Environment Variables**:
   Add these in the Amplify Console:
   *   `DATABASE_URL`: `postgresql://postgres:password@your-rds-endpoint:5432/student_db`
   *   `NEXT_PUBLIC_AI_SERVICE_URL`: `http://your-ec2-ip:8000`
   *   `JWT_SECRET`: Generate a secure string.

---

## 🐘 Phase 3: Big Data Pipeline (EMR)

To process massive attendance logs for year-over-year analytics:

1. **Launch EMR Cluster**:
   *   Applications: Spark, Hadoop, Hive.
   *   Instance type: `m5.xlarge` (1 Master, 2 Workers).
2. **Run Analytics**:
   Upload `scripts/spark_analytics.py` to S3 and add it as an EMR Step:
   ```bash
   spark-submit s3://your-bucket/scripts/spark_analytics.py \
     --mode spark \
     --input s3://your-bucket/attendance-logs/ \
     --output s3://your-bucket/reports/
   ```

---

## 🔐 Security Best Practices

1. **VPC Peering**: Ensure the Next.js app and AI service are in the same VPC or use Private IPs for lower latency.
2. **IAM Roles**: Assign an IAM Role to the AI Service EC2 instance to allow it to write processed frames to S3.
3. **SSL/TLS**: Use **AWS Certificate Manager (ACM)** with a Load Balancer to serve the site over HTTPS.

---

## 🛠️ Troubleshooting

*   **AI Service Offline**: Check Security Group port 8000 and ensure `uvicorn` is running.
*   **Database Timeout**: Ensure the RDS instance allows connections from the EC2 and Amplify IP ranges.
*   **Hadoop Errors**: Verify that your input CSVs on S3 are in the correct format as expected by `spark_analytics.py`.

---
*Created on: 2026-04-29*
