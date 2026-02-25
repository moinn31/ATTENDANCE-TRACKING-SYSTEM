# Hadoop Integration Guide - Smart Attendance System

## Overview

The Smart Attendance System includes a Hadoop-based big data analytics pipeline for processing large-scale attendance data. This guide explains how to set up, configure, and use the Hadoop integration.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Smart Attendance System                                     │
├─────────────────────────────────────────────────────────────┤
│ 1. Real-time Scanner (face-api.js)                         │
│    └─> Records attendance with confidence scores            │
├─────────────────────────────────────────────────────────────┤
│ 2. Database Layer (Supabase/PostgreSQL)                    │
│    └─> Stores attendance records and metrics                │
├─────────────────────────────────────────────────────────────┤
│ 3. Export Layer (data-export.ts)                           │
│    └─> Exports data to CSV for Hadoop processing            │
├─────────────────────────────────────────────────────────────┤
│ 4. Hadoop Processing                                        │
│    ├─> HDFS: Distributed file storage                       │
│    ├─> MapReduce: Batch analytics processing                │
│    └─> YARN: Job scheduling and resource management         │
├─────────────────────────────────────────────────────────────┤
│ 5. Analytics Pipeline (hadoop-analytics.py)               │
│    └─> Generates attendance trends and insights             │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Linux server (Ubuntu 20.04+ recommended)
- Java 11+ installed
- 8GB+ RAM for Hadoop cluster
- At least 20GB free disk space
- Root or sudo access for installation

## Installation

### Step 1: Run Setup Script

```bash
# Make the setup script executable
chmod +x scripts/hadoop-setup.sh

# Run with sudo
sudo ./scripts/hadoop-setup.sh
```

This script:
- Installs Java and SSH
- Downloads Hadoop 3.3.6
- Creates hadoop user and directories
- Configures HDFS and YARN
- Sets up SSH key-based authentication

### Step 2: Verify Installation

```bash
# Switch to hadoop user
sudo su - hadoop

# Start Hadoop services
start-dfs.sh
start-yarn.sh

# Check status
hdfs dfsadmin -report
yarn node -list
```

### Step 3: Access Web UIs

- **HDFS NameNode**: http://localhost:9870
- **YARN ResourceManager**: http://localhost:8088

## Configuration

### Core Configuration Files

Located in `/opt/hadoop/etc/hadoop/`:

#### core-site.xml
```xml
<property>
  <name>fs.defaultFS</name>
  <value>hdfs://localhost:9000</value>
</property>
<property>
  <name>hadoop.tmp.dir</name>
  <value>/tmp/hadoop</value>
</property>
```

#### hdfs-site.xml
```xml
<property>
  <name>dfs.replication</name>
  <value>1</value>  <!-- Single node cluster -->
</property>
<property>
  <name>dfs.namenode.name.dir</name>
  <value>/tmp/hadoop/namenode</value>
</property>
```

#### yarn-site.xml
```xml
<property>
  <name>yarn.nodemanager.aux-services</name>
  <value>mapreduce_shuffle</value>
</property>
```

## Data Pipeline

### Step 1: Export Attendance Data

Export data from Supabase to CSV:

```bash
# Using the data export utility
node -e "
  import('./scripts/data-export.ts').then(m => {
    const exporter = new m.DataExporter();
    // Export data from your database
  });
"

# Or manually export from Supabase dashboard
# SQL Query:
# SELECT student_id, date, status, confidence, marked_at 
# FROM attendance_records 
# ORDER BY date DESC;
```

### Step 2: Copy Data to HDFS

```bash
# Create HDFS directory
hdfs dfs -mkdir -p /attendance/input

# Copy CSV file to HDFS
hdfs dfs -put attendance_export.csv /attendance/input/

# Verify upload
hdfs dfs -ls /attendance/input/
```

### Step 3: Run MapReduce Analytics

```bash
# Run analytics with Python MapReduce
python scripts/hadoop-analytics.py \
  --mode hdfs \
  --input attendance_export.csv \
  --output analytics_report.json \
  --hdfs-host localhost \
  --hdfs-port 9000
```

### Step 4: Retrieve Results

```bash
# Copy results from HDFS
hdfs dfs -getmerge /attendance/output results.txt

# View analytics report
cat results.txt
```

## MapReduce Jobs

### Mapper Function

The mapper processes raw attendance records:

```python
# Input: attendance_records.csv
# date, student_id, status, confidence

# Output: (date, student_id, status, confidence)
# Groups by date for daily aggregation
```

### Reducer Function

The reducer aggregates daily statistics:

```python
# Input: (date, student_id, status, confidence)

# Output: 
# date | present_count | absent_count | late_count | avg_confidence
# 2024-02-20 | 28 | 2 | 1 | 94.25
```

## Query Examples

### Daily Attendance Summary

```bash
# Get attendance for specific date
hdfs dfs -cat /attendance/output/part-r-00000 | \
  grep "2024-02-20"

# Output: 2024-02-20  28  2  1  94.25
```

### Weekly Trend Analysis

```bash
# Generate weekly report
python scripts/hadoop-analytics.py \
  --mode hdfs \
  --input weekly_data.csv \
  --output weekly_report.json
```

### Student Performance Analytics

```python
# Custom Python script for student-level analytics
from hadoop_analytics import AttendanceAnalytics

analytics = AttendanceAnalytics()
records = analytics.fetch_results_from_hdfs('/attendance/output')

# Group by student
student_stats = {}
for record in records:
  student = record['student_id']
  if student not in student_stats:
    student_stats[student] = {'present': 0, 'absent': 0}
  student_stats[student][record['status']] += 1

# Calculate attendance rates
for student, stats in student_stats.items():
  total = stats['present'] + stats['absent']
  rate = (stats['present'] / total) * 100 if total > 0 else 0
  print(f"{student}: {rate:.1f}% attendance")
```

## Performance Tuning

### Cluster Configuration

```bash
# Edit $HADOOP_HOME/etc/hadoop/mapred-site.xml

<!-- Mapper/Reducer memory -->
<property>
  <name>mapreduce.map.memory.mb</name>
  <value>1024</value>  <!-- 1GB per mapper -->
</property>

<!-- Parallel mappers -->
<property>
  <name>mapreduce.job.maps</name>
  <value>4</value>  <!-- Number of parallel mappers -->
</property>

<!-- Parallel reducers -->
<property>
  <name>mapreduce.job.reduces</name>
  <value>2</value>  <!-- Number of parallel reducers -->
</property>
```

### Data Partitioning

For large datasets, partition data by date:

```bash
# Create monthly directories
hdfs dfs -mkdir /attendance/2024-01
hdfs dfs -mkdir /attendance/2024-02
hdfs dfs -mkdir /attendance/2024-03

# Copy data to appropriate months
hdfs dfs -put jan_data.csv /attendance/2024-01/
hdfs dfs -put feb_data.csv /attendance/2024-02/
```

## Monitoring

### Check Job Status

```bash
# List running jobs
yarn application -list

# View job details
yarn application -status <application_id>

# Check job history
yarn logs -applicationId <application_id>
```

### Monitor Cluster Health

```bash
# HDFS status
hdfs dfsadmin -report

# YARN status
yarn node -list -all

# Check disk usage
hdfs dfs -du -h /attendance/

# Space available
hdfs dfs -df -h /
```

## Troubleshooting

### Common Issues

#### 1. "Connection refused" errors

```bash
# Check if HDFS is running
jps

# Should see:
# NameNode
# DataNode
# SecondaryNameNode
# ResourceManager
# NodeManager

# Restart if needed
stop-dfs.sh
start-dfs.sh
```

#### 2. "Permission denied" errors

```bash
# Check file permissions
hdfs dfs -ls -l /attendance/

# Fix permissions
hdfs dfs -chmod 755 /attendance/
hdfs dfs -chown hadoop:hadoop /attendance/
```

#### 3. Job failures

```bash
# Check logs
tail -f $HADOOP_HOME/logs/hadoop-hadoop-namenode-*.log
tail -f $HADOOP_HOME/logs/yarn-*.log

# Run job with verbose output
hadoop jar streaming.jar \
  -mapper mapper.py \
  -reducer reducer.py \
  -input /input \
  -output /output \
  -verbose
```

#### 4. Insufficient disk space

```bash
# Check available space
df -h

# Clean up old data
hdfs dfs -rm -r /attendance/old_data/

# Archive to external storage
hdfs dfs -getmerge /attendance/output archive.tar.gz
```

## Advanced Topics

### Custom Hadoop Streaming Jobs

```python
#!/usr/bin/env python3
import sys
import json

# Custom mapper
for line in sys.stdin:
  record = json.loads(line)
  # Custom processing
  print(f"{record['date']}\t{record['student_id']}\t{record['status']}")
```

### Integration with Spark (Optional)

```python
from pyspark.sql import SparkSession

spark = SparkSession.builder \
  .appName("AttendanceAnalytics") \
  .getOrCreate()

df = spark.read.csv("/attendance/input/data.csv", header=True)
result = df.groupBy("date").agg({"status": "count"})
result.write.mode("overwrite").csv("/attendance/output/spark_result")
```

### Scheduled Jobs with Cron

```bash
# Edit crontab
crontab -e

# Add daily analytics job
0 2 * * * cd /opt/smart-attendance && \
  python scripts/hadoop-analytics.py \
  --mode hdfs \
  --input daily_export.csv \
  --output daily_report.json
```

## Best Practices

1. **Data Partitioning**: Organize data by date/month for faster queries
2. **Compression**: Compress data files to reduce storage: `gzip attendance.csv`
3. **Backup**: Regularly backup HDFS data: `hdfs dfs -getmerge /attendance /backup/`
4. **Monitoring**: Set up alerts for job failures and cluster health
5. **Security**: Enable Kerberos authentication for production clusters
6. **Testing**: Test MapReduce jobs on sample data before production runs

## Performance Benchmarks

Typical performance on single-node Hadoop (8GB RAM):

- **1 month data** (30,000 records): 2-3 seconds
- **1 year data** (365,000 records): 15-20 seconds
- **Multi-year data** (1M+ records): 1-2 minutes

## Resources

- [Apache Hadoop Documentation](https://hadoop.apache.org/docs/)
- [HDFS User Guide](https://hadoop.apache.org/docs/stable/hadoop-project-dist/hadoop-hdfs/HdfsUserGuide.html)
- [MapReduce Tutorial](https://hadoop.apache.org/docs/current/hadoop-mapreduce-client/hadoop-mapreduce-client-core/MapReduceTutorial.html)
- [Hadoop Streaming](https://hadoop.apache.org/docs/current/hadoop-streaming/HadoopStreaming.html)

## Support

For issues:
1. Check Hadoop logs in `$HADOOP_HOME/logs/`
2. Verify HDFS status with `hdfs dfsadmin -report`
3. Review this guide's troubleshooting section
4. Check Apache Hadoop documentation

---

**Version**: 1.0  
**Last Updated**: 2024-02-23  
**Maintainer**: Smart Attendance System Team
