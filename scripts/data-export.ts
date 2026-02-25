#!/usr/bin/env node

/**
 * Data Export Utility for Smart Attendance System
 * Exports attendance records to CSV for Hadoop processing
 */

import * as fs from 'fs'
import * as path from 'path'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'

interface AttendanceRecord {
  student_id: string
  student_name: string
  date: string
  status: 'present' | 'absent' | 'late'
  confidence: number
  marked_at: string
}

interface HadoopInput {
  date: string
  student_id: string
  status: string
  confidence: number
}

interface HadoopOutput {
  date: string
  present_count: number
  absent_count: number
  late_count: number
  avg_confidence: number
  total_marked: number
}

class DataExporter {
  private outputDir: string

  constructor(outputDir: string = './data/export') {
    this.outputDir = outputDir
    this.ensureOutputDir()
  }

  private ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true })
    }
  }

  /**
   * Convert attendance records to Hadoop-compatible CSV format
   */
  public convertToHadoopFormat(records: AttendanceRecord[]): HadoopInput[] {
    return records.map((record) => ({
      date: record.date,
      student_id: record.student_id,
      status: record.status,
      confidence: record.confidence,
    }))
  }

  /**
   * Export attendance records to CSV
   */
  public exportToCSV(records: AttendanceRecord[], filename: string = 'attendance_export.csv'): string {
    const csv = stringify(records, {
      header: true,
      columns: ['student_id', 'student_name', 'date', 'status', 'confidence', 'marked_at'],
    })

    const filepath = path.join(this.outputDir, filename)
    fs.writeFileSync(filepath, csv)

    console.log(`[v0] Exported ${records.length} records to ${filepath}`)
    return filepath
  }

  /**
   * Export data in Hadoop input format
   */
  public exportHadoopInput(records: AttendanceRecord[], filename: string = 'hadoop_input.csv'): string {
    const hadoopRecords = this.convertToHadoopFormat(records)
    const csv = stringify(hadoopRecords, {
      header: true,
      columns: ['date', 'student_id', 'status', 'confidence'],
    })

    const filepath = path.join(this.outputDir, filename)
    fs.writeFileSync(filepath, csv)

    console.log(`[v0] Exported ${records.length} records in Hadoop format to ${filepath}`)
    return filepath
  }

  /**
   * Process CSV file from Hadoop MapReduce output
   */
  public processHadoopOutput(outputFile: string): HadoopOutput[] {
    if (!fs.existsSync(outputFile)) {
      throw new Error(`Output file not found: ${outputFile}`)
    }

    const content = fs.readFileSync(outputFile, 'utf-8')
    const lines = content.trim().split('\n')

    const results: HadoopOutput[] = lines.map((line) => {
      const [date, present, absent, late, confidence] = line.split('\t')
      return {
        date,
        present_count: parseInt(present) || 0,
        absent_count: parseInt(absent) || 0,
        late_count: parseInt(late) || 0,
        avg_confidence: parseFloat(confidence) || 0,
        total_marked: (parseInt(present) || 0) + (parseInt(absent) || 0) + (parseInt(late) || 0),
      }
    })

    return results
  }

  /**
   * Generate JSON report from Hadoop output
   */
  public generateReport(hadoopOutput: HadoopOutput[], reportName: string = 'attendance_report'): void {
    const report = {
      generated_at: new Date().toISOString(),
      total_days: hadoopOutput.length,
      total_records: hadoopOutput.reduce((sum, day) => sum + day.total_marked, 0),
      summary: {
        total_present: hadoopOutput.reduce((sum, day) => sum + day.present_count, 0),
        total_absent: hadoopOutput.reduce((sum, day) => sum + day.absent_count, 0),
        total_late: hadoopOutput.reduce((sum, day) => sum + day.late_count, 0),
        avg_confidence: (
          hadoopOutput.reduce((sum, day) => sum + day.avg_confidence, 0) / hadoopOutput.length
        ).toFixed(2),
      },
      daily_breakdown: hadoopOutput,
    }

    const filepath = path.join(this.outputDir, `${reportName}.json`)
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2))

    console.log(`[v0] Generated report: ${filepath}`)
  }

  /**
   * Export data by date range
   */
  public exportByDateRange(
    records: AttendanceRecord[],
    startDate: string,
    endDate: string,
    filename?: string
  ): string {
    const filtered = records.filter((record) => {
      const recordDate = new Date(record.date)
      const start = new Date(startDate)
      const end = new Date(endDate)
      return recordDate >= start && recordDate <= end
    })

    const defaultFilename = `attendance_${startDate}_to_${endDate}.csv`
    return this.exportToCSV(filtered, filename || defaultFilename)
  }

  /**
   * Generate statistics summary
   */
  public generateStatistics(records: AttendanceRecord[]) {
    const stats = {
      total_records: records.length,
      date_range: {
        start: records.reduce((min, r) => (r.date < min ? r.date : min), records[0].date),
        end: records.reduce((max, r) => (r.date > max ? r.date : max), records[0].date),
      },
      by_status: {
        present: records.filter((r) => r.status === 'present').length,
        absent: records.filter((r) => r.status === 'absent').length,
        late: records.filter((r) => r.status === 'late').length,
      },
      confidence: {
        min: Math.min(...records.map((r) => r.confidence)),
        max: Math.max(...records.map((r) => r.confidence)),
        avg: (records.reduce((sum, r) => sum + r.confidence, 0) / records.length).toFixed(2),
      },
      unique_students: new Set(records.map((r) => r.student_id)).size,
      unique_dates: new Set(records.map((r) => r.date)).size,
    }

    return stats
  }
}

// Main execution
function main() {
  // Example usage
  const exporter = new DataExporter()

  // Mock attendance data
  const mockData: AttendanceRecord[] = [
    {
      student_id: 'STU001',
      student_name: 'John Doe',
      date: '2024-02-20',
      status: 'present',
      confidence: 95.5,
      marked_at: '2024-02-20T09:00:00Z',
    },
    {
      student_id: 'STU002',
      student_name: 'Jane Smith',
      date: '2024-02-20',
      status: 'present',
      confidence: 94.2,
      marked_at: '2024-02-20T09:01:00Z',
    },
    {
      student_id: 'STU003',
      student_name: 'Bob Johnson',
      date: '2024-02-20',
      status: 'late',
      confidence: 92.8,
      marked_at: '2024-02-20T09:15:00Z',
    },
  ]

  // Export to CSV
  exporter.exportToCSV(mockData)

  // Export in Hadoop format
  exporter.exportHadoopInput(mockData)

  // Generate statistics
  const stats = exporter.generateStatistics(mockData)
  console.log('[v0] Statistics:', stats)

  // Export by date range
  exporter.exportByDateRange(mockData, '2024-02-20', '2024-02-20')
}

// Execute if run directly
if (require.main === module) {
  main()
}

export { DataExporter, AttendanceRecord, HadoopInput, HadoopOutput }
