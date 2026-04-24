const { Pool } = require('pg');

const pool = new Pool({
  host: 'student-db.c49geqe6ga6f.us-east-1.rds.amazonaws.com',
  port: 5432,
  user: 'postgres',
  password: 'ADUNYi5usMSHSss',
  database: 'student_db',
  ssl: { rejectUnauthorized: false },
});

async function debug() {
  try {
    console.log('=== DEBUGGING FACE EMBEDDINGS ===\n');

    // 1. Check students
    const students = await pool.query('SELECT id, name, roll_number FROM public.students');
    console.log('Students in DB:', students.rows.length);
    students.rows.forEach(r => console.log(`  - ${r.name} (${r.id.substring(0, 8)}...) roll: ${r.roll_number}`));

    // 2. Check embeddings
    const embeddings = await pool.query('SELECT student_id, octet_length(embedding_vector::text) as text_len, pg_typeof(embedding_vector) as col_type FROM public.face_embeddings');
    console.log('\nEmbeddings in DB:', embeddings.rows.length);
    embeddings.rows.forEach(r => console.log(`  - student_id: ${r.student_id.substring(0, 8)}... | type: ${r.col_type} | text_len: ${r.text_len}`));

    // 3. Check what the raw embedding looks like
    const raw = await pool.query('SELECT student_id, embedding_vector FROM public.face_embeddings LIMIT 1');
    if (raw.rows.length > 0) {
      const val = raw.rows[0].embedding_vector;
      console.log('\n=== RAW EMBEDDING SAMPLE ===');
      console.log('JS typeof:', typeof val);
      console.log('Is Buffer:', Buffer.isBuffer(val));
      console.log('Is Array:', Array.isArray(val));
      console.log('Constructor:', val?.constructor?.name);
      
      // Try to extract the actual data
      let parsed = null;
      if (Buffer.isBuffer(val)) {
        const str = val.toString('utf8');
        console.log('Buffer as UTF8 (first 200 chars):', str.substring(0, 200));
        try { parsed = JSON.parse(str); } catch(e) { console.log('Buffer JSON parse failed:', e.message); }
      } else if (typeof val === 'string') {
        console.log('String value (first 200 chars):', val.substring(0, 200));
        try { parsed = JSON.parse(val); } catch(e) { console.log('String JSON parse failed:', e.message); }
      } else if (typeof val === 'object' && val !== null) {
        console.log('Object keys (first 10):', Object.keys(val).slice(0, 10));
        console.log('Object JSON (first 200 chars):', JSON.stringify(val).substring(0, 200));
      }

      if (parsed) {
        console.log('\nParsed successfully!');
        console.log('Is Array:', Array.isArray(parsed));
        console.log('Length:', Array.isArray(parsed) ? parsed.length : 'N/A');
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log('First element type:', typeof parsed[0]);
          console.log('First 5 elements:', parsed.slice(0, 5));
        }
      }
    } else {
      console.log('\n*** NO EMBEDDINGS FOUND IN DATABASE ***');
      console.log('You need to enroll student faces first!');
    }

    // 4. Check column type in the schema
    const colInfo = await pool.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'face_embeddings' AND table_schema = 'public'
    `);
    console.log('\n=== SCHEMA INFO ===');
    colInfo.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} (${r.udt_name})`));

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await pool.end();
  }
}

debug();
