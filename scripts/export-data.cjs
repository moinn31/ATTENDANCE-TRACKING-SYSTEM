const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: 'student-db.c49geqe6ga6f.us-east-1.rds.amazonaws.com',
  port: 5432,
  user: 'postgres',
  password: 'ADUNYi5usMSHSss',
  database: 'student_db',
  ssl: { rejectUnauthorized: false },
});

async function exportData() {
  try {
    console.log('=== EXPORTING ATTENDANCE DATA FOR SPARK ===\n');

    const result = await pool.query(`
      SELECT 
        ar.id as record_id,
        ar.student_id,
        s.name as student_name,
        ar.date,
        ar.status,
        ar.class_name,
        ar.subject_name,
        ar.detected_confidence as confidence,
        ar.timestamp
      FROM public.attendance_records ar
      JOIN public.students s ON s.id = ar.student_id
      ORDER BY ar.timestamp DESC
    `);

    console.log(`Found ${result.rows.length} records.`);

    if (result.rows.length === 0) {
      console.log('No records found to export.');
      return;
    }

    const headers = Object.keys(result.rows[0]);
    const csvContent = [
      headers.join(','),
      ...result.rows.map(row => headers.map(header => {
        const val = row[header];
        if (val === null || val === undefined) return '';
        if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(','))
    ].join('\n');

    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir);
    }

    const outputPath = path.join(dataDir, 'attendance_export.csv');
    fs.writeFileSync(outputPath, csvContent);
    console.log(`Data exported to: ${outputPath}`);

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await pool.end();
  }
}

exportData();
