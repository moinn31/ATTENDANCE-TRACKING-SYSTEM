#!/usr/bin/env python3
"""
Smart Attendance System - Hadoop-based Big Data Analytics
Processes attendance data using Hadoop MapReduce for trend analysis and reporting
"""

import os
import json
import csv
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
import subprocess
import tempfile


class AttendanceAnalytics:
    """Process attendance data using Hadoop for large-scale analytics"""

    def __init__(self, hdfs_host: str = "localhost", hdfs_port: int = 9000):
        self.hdfs_host = hdfs_host
        self.hdfs_port = hdfs_port
        self.hdfs_path = f"hdfs://{hdfs_host}:{hdfs_port}"
        self.mapper_code = self._get_mapper_script()
        self.reducer_code = self._get_reducer_script()

    def _get_mapper_script(self) -> str:
        """Get the mapper script for processing attendance records"""
        return '''
import sys
import json

# Mapper: Extract attendance information and emit key-value pairs
for line in sys.stdin:
    try:
        record = json.loads(line.strip())
        student_id = record.get('student_id')
        date = record.get('date')
        status = record.get('status')  # 'present', 'absent', 'late'
        confidence = float(record.get('confidence', 0))
        
        # Emit (date, student_id) -> (status, confidence)
        print(f"{date}\t{student_id}\t{status}\t{confidence}")
    except:
        continue
'''

    def _get_reducer_script(self) -> str:
        """Get the reducer script for aggregating attendance analytics"""
        return '''
import sys
from collections import defaultdict

# Reducer: Aggregate attendance statistics
current_date = None
date_stats = defaultdict(lambda: {'present': 0, 'absent': 0, 'late': 0, 'confidence': []})

for line in sys.stdin:
    try:
        parts = line.strip().split('\t')
        if len(parts) >= 4:
            date, student_id, status, confidence = parts[0], parts[1], parts[2], float(parts[3])
            
            if current_date != date and current_date is not None:
                # Output previous day's statistics
                stats = date_stats[current_date]
                avg_confidence = sum(stats['confidence']) / len(stats['confidence']) if stats['confidence'] else 0
                print(f"{current_date}\\t{stats['present']}\\t{stats['absent']}\\t{stats['late']}\\t{avg_confidence:.2f}")
                current_date = date
            
            current_date = date
            date_stats[date][status] += 1
            date_stats[date]['confidence'].append(confidence)
    except:
        continue

# Output final day
if current_date:
    stats = date_stats[current_date]
    avg_confidence = sum(stats['confidence']) / len(stats['confidence']) if stats['confidence'] else 0
    print(f"{current_date}\\t{stats['present']}\\t{stats['absent']}\\t{stats['late']}\\t{avg_confidence:.2f}")
'''

    def export_to_hdfs(self, local_file: str, hdfs_destination: str) -> bool:
        """Export local CSV file to HDFS"""
        try:
            cmd = [
                "hdfs", "dfs", "-put",
                "-f",  # Force overwrite
                local_file,
                f"{self.hdfs_path}{hdfs_destination}"
            ]
            subprocess.run(cmd, check=True, capture_output=True)
            print(f"[v0] Exported {local_file} to {hdfs_destination}")
            return True
        except subprocess.CalledProcessError as e:
            print(f"[v0] Error exporting to HDFS: {e}")
            return False

    def run_mapreduce_job(self, input_path: str, output_path: str, job_name: str) -> bool:
        """Run a MapReduce job for attendance analytics"""
        try:
            # Create mapper and reducer files
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as mapper_file:
                mapper_file.write(self.mapper_code)
                mapper_path = mapper_file.name

            with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as reducer_file:
                reducer_file.write(self.reducer_code)
                reducer_path = reducer_file.name

            # Run Hadoop streaming job
            cmd = [
                "hadoop", "jar", "/opt/hadoop/share/hadoop/tools/lib/hadoop-streaming-*.jar",
                "-mapper", f"python {mapper_path}",
                "-reducer", f"python {reducer_path}",
                "-input", f"{self.hdfs_path}{input_path}",
                "-output", f"{self.hdfs_path}{output_path}"
            ]

            print(f"[v0] Running MapReduce job: {job_name}")
            subprocess.run(cmd, check=True)
            print(f"[v0] Job completed: {job_name}")

            # Clean up temporary files
            os.unlink(mapper_path)
            os.unlink(reducer_path)

            return True
        except subprocess.CalledProcessError as e:
            print(f"[v0] Error running MapReduce job: {e}")
            return False

    def fetch_results_from_hdfs(self, hdfs_path: str, local_output: str) -> bool:
        """Fetch MapReduce results from HDFS"""
        try:
            cmd = [
                "hdfs", "dfs", "-getmerge",
                f"{self.hdfs_path}{hdfs_path}",
                local_output
            ]
            subprocess.run(cmd, check=True, capture_output=True)
            print(f"[v0] Fetched results to {local_output}")
            return True
        except subprocess.CalledProcessError as e:
            print(f"[v0] Error fetching from HDFS: {e}")
            return False

    def generate_analytics_report(self, attendance_data: List[Dict]) -> Dict:
        """Generate comprehensive analytics from attendance data"""
        report = {
            "generated_at": datetime.now().isoformat(),
            "total_records": len(attendance_data),
            "daily_summary": defaultdict(lambda: {"present": 0, "absent": 0, "late": 0}),
            "student_summary": defaultdict(lambda: {"present": 0, "absent": 0, "late": 0}),
            "confidence_stats": {"min": 100, "max": 0, "avg": 0},
        }

        total_confidence = 0
        confidence_count = 0

        for record in attendance_data:
            date = record.get("date")
            student_id = record.get("student_id")
            status = record.get("status", "unknown")
            confidence = float(record.get("confidence", 0))

            # Daily summary
            if status in report["daily_summary"][date]:
                report["daily_summary"][date][status] += 1

            # Student summary
            if status in report["student_summary"][student_id]:
                report["student_summary"][student_id][status] += 1

            # Confidence statistics
            if confidence > 0:
                report["confidence_stats"]["min"] = min(report["confidence_stats"]["min"], confidence)
                report["confidence_stats"]["max"] = max(report["confidence_stats"]["max"], confidence)
                total_confidence += confidence
                confidence_count += 1

        if confidence_count > 0:
            report["confidence_stats"]["avg"] = total_confidence / confidence_count

        return report

    def process_attendance_data(self, input_csv: str, output_json: str) -> bool:
        """Process attendance data and generate analytics"""
        try:
            attendance_data = []

            # Read input CSV
            with open(input_csv, 'r') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    attendance_data.append(row)

            # Generate report
            report = self.generate_analytics_report(attendance_data)

            # Save report
            with open(output_json, 'w') as f:
                json.dump(report, f, indent=2, default=str)

            print(f"[v0] Analytics report generated: {output_json}")
            return True
        except Exception as e:
            print(f"[v0] Error processing attendance data: {e}")
            return False


def main():
    """Main entry point for Hadoop analytics"""
    import argparse

    parser = argparse.ArgumentParser(description="Attendance System Hadoop Analytics")
    parser.add_argument("--mode", choices=["local", "hdfs"], default="local",
                       help="Processing mode: local or HDFS")
    parser.add_argument("--input", required=True, help="Input CSV file path")
    parser.add_argument("--output", required=True, help="Output file path")
    parser.add_argument("--hdfs-host", default="localhost", help="HDFS namenode host")
    parser.add_argument("--hdfs-port", type=int, default=9000, help="HDFS namenode port")

    args = parser.parse_args()

    analytics = AttendanceAnalytics(args.hdfs_host, args.hdfs_port)

    if args.mode == "local":
        # Process locally
        success = analytics.process_attendance_data(args.input, args.output)
    else:
        # Process using Hadoop
        hdfs_input = "/attendance/input/data.csv"
        hdfs_output = "/attendance/output"

        # Export to HDFS
        if not analytics.export_to_hdfs(args.input, hdfs_input):
            return 1

        # Run MapReduce
        if not analytics.run_mapreduce_job(hdfs_input, hdfs_output, "AttendanceAnalytics"):
            return 1

        # Fetch results
        if not analytics.fetch_results_from_hdfs(hdfs_output, args.output):
            return 1

        success = True

    return 0 if success else 1


if __name__ == "__main__":
    exit(main())
