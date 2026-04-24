const { Pool } = require('pg');

const pool = new Pool({
  host: 'student-db.c49geqe6ga6f.us-east-1.rds.amazonaws.com',
  port: 5432,
  user: 'postgres',
  password: 'ADUNYi5usMSHSss',
  database: 'student_db',
  ssl: { rejectUnauthorized: false },
});

async function check() {
  try {
    // Time the students query
    console.log('=== TIMING DATABASE QUERIES ===\n');
    
    let start = Date.now();
    const s1 = await pool.query('SELECT id, name, roll_number FROM public.students');
    console.log('Students query:', (Date.now() - start) + 'ms |', s1.rows.length, 'rows');
    
    start = Date.now();
    const s2 = await pool.query('SELECT DISTINCT student_id FROM public.face_embeddings');
    console.log('Enrolled check:', (Date.now() - start) + 'ms |', s2.rows.length, 'rows');
    
    start = Date.now();
    const s3 = await pool.query("SELECT DISTINCT ON (student_id) student_id, embedding_vector, created_at FROM public.face_embeddings ORDER BY student_id, created_at DESC");
    console.log('Embeddings query:', (Date.now() - start) + 'ms |', s3.rows.length, 'rows');
    
    start = Date.now();
    const s4 = await pool.query('SELECT id, name, roll_number, created_at FROM public.students ORDER BY created_at DESC');
    console.log('Students ordered:', (Date.now() - start) + 'ms |', s4.rows.length, 'rows');

    // Check if there are indexes
    start = Date.now();
    const indexes = await pool.query(`
      SELECT indexname, tablename, indexdef 
      FROM pg_indexes 
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `);
    console.log('\nIndex check:', (Date.now() - start) + 'ms');
    console.log('\n=== INDEXES ===');
    indexes.rows.forEach(r => console.log(' [' + r.tablename + ']', r.indexname));

    // Check if the tables have proper primary key indexes
    console.log('\n=== CONNECTION POOL STATS ===');
    console.log('Total:', pool.totalCount);
    console.log('Idle:', pool.idleCount);
    console.log('Waiting:', pool.waitingCount);

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await pool.end();
  }
}

check();
