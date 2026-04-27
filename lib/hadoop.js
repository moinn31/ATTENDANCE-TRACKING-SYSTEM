import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execPromise = promisify(exec);

/**
 * Hadoop Integration Utility
 * 
 * This utility handles saving attendance records to HDFS.
 * Since the user is using Hadoop in Docker, we use 'docker exec' 
 * to pipe data into the HDFS file system.
 * 
 * Each record is saved as a unique file to avoid HDFS write conflicts.
 * Spark can later read the entire /attendance/realtime/ directory at once.
 */

// Simple queue to prevent concurrent docker exec commands from colliding
let writeQueue = Promise.resolve();

export async function saveToHadoop(record) {
  // Queue writes so they execute one at a time
  writeQueue = writeQueue.then(() => _doSave(record)).catch(() => {});
  return writeQueue;
}

async function _doSave(record) {
  const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tmpFileName = `hdfs_${uniqueId}.csv`;
  const tmpFile = path.join(process.cwd(), 'data', tmpFileName);

  try {
    const { student_id, status, confidence, date, class_name, subject_name } = record;
    
    // Prepare CSV line
    const timestamp = new Date().toISOString();
    const csvLine = `${uniqueId},${student_id},${date},${status},"${class_name || ''}","${subject_name || ''}",${confidence || 0},${timestamp}\n`;
    
    // Each record gets its own unique file in HDFS (standard big data pattern)
    const hdfsDir = '/attendance/realtime';
    const hdfsFile = `${hdfsDir}/record_${uniqueId}.csv`;
    
    // Ensure local data directory exists
    const dataDir = path.dirname(tmpFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(tmpFile, csvLine);
    
    // Step 1: Ensure HDFS directory exists
    await execPromise('docker exec namenode hdfs dfs -mkdir -p /attendance/realtime');
    
    // Step 2: Copy the local file into the Docker container with a unique name
    const containerTmp = `/tmp/${tmpFileName}`;
    await execPromise(`docker cp "${tmpFile}" namenode:${containerTmp}`);
    
    // Step 3: Put into HDFS as a unique file (no conflicts possible)
    await execPromise(`docker exec namenode hdfs dfs -put ${containerTmp} ${hdfsFile}`);
    
    // Step 4: Clean up container tmp file
    await execPromise(`docker exec namenode rm -f ${containerTmp}`).catch(() => {});
    
    console.log(`[Hadoop] Record saved to HDFS: ${hdfsFile}`);
    return true;
  } catch (error) {
    console.error('[Hadoop] Failed to save record:', error.message);
    return false;
  } finally {
    // Clean up local tmp file
    try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch {}
  }
}
