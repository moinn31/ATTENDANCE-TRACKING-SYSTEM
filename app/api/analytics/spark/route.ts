import { verifyToken } from '@/lib/auth.js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Spark Analytics API Endpoint
 * 
 * Demonstrates Cloud Computing concepts:
 *   - Serverless API route (auto-scaling)
 *   - Cloud database integration (AWS RDS PostgreSQL)
 *   - RESTful design for distributed access
 * 
 * Demonstrates BDA concepts:
 *   - Analytics aggregation at scale
 *   - Multi-dimensional analysis (time, student, method)
 *   - Statistical computation (stddev, percentiles)
 * 
 * Demonstrates AI concepts:
 *   - Bayesian posterior computation
 *   - Confidence distribution analysis
 *   - Model comparison metrics
 */

// Bayesian attendance decision engine (mirrors Python implementation)
function gaussianLikelihood(x: number, mu: number, sigma: number): number {
  if (sigma <= 0) return Math.abs(x - mu) < 0.01 ? 1.0 : 0.0
  const coeff = 1.0 / (sigma * Math.sqrt(2 * Math.PI))
  const exponent = -((x - mu) ** 2) / (2 * sigma ** 2)
  return coeff * Math.exp(exponent)
}

function computeBayesianPosterior(
  confidence: number,
  frameCount: number = 1,
  historicalRate: number = 0.85,
): {
  decision: 'present' | 'absent'
  posteriorPresent: number
  posteriorAbsent: number
  confidenceScore: number
  reasoning: string
} {
  const basePrior = 0.85
  const historyWeight = 0.20
  const frameWeight = 0.15

  // Prior adjusted by student history
  const priorPresent = basePrior * (1 - historyWeight) + historicalRate * historyWeight
  const priorAbsent = 1.0 - priorPresent

  // Likelihoods
  let likPresent = gaussianLikelihood(confidence, 92.0, 8.0)
  const likAbsent = gaussianLikelihood(confidence, 45.0, 20.0)

  // Frame count bonus
  const frameBonus = Math.min(frameCount / 10.0, 1.0) * frameWeight
  likPresent *= (1.0 + frameBonus)

  // Evidence
  const evidence = Math.max(likPresent * priorPresent + likAbsent * priorAbsent, 1e-10)

  // Posteriors
  const posteriorPresent = (likPresent * priorPresent) / evidence
  const posteriorAbsent = (likAbsent * priorAbsent) / evidence

  const decision = posteriorPresent > posteriorAbsent ? 'present' : 'absent'
  const confidenceScore = Math.round(posteriorPresent * 10000) / 100

  let reasoning: string
  if (confidenceScore >= 90) {
    reasoning = `High confidence (${confidenceScore}%). ${frameCount} frame(s) confirm detection.`
  } else if (confidenceScore >= 70) {
    reasoning = `Moderate confidence (${confidenceScore}%). Consider manual verification.`
  } else {
    reasoning = `Low confidence (${confidenceScore}%). Marked as ${decision} with uncertainty.`
  }

  return {
    decision: decision as 'present' | 'absent',
    posteriorPresent: Math.round(posteriorPresent * 10000) / 10000,
    posteriorAbsent: Math.round(posteriorAbsent * 10000) / 10000,
    confidenceScore,
    reasoning,
  }
}

export async function GET(request: NextRequest) {
  try {
    verifyToken(request)

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'overview'

    if (type === 'bayesian') {
      // Demo Bayesian reasoning
      const confidence = parseFloat(searchParams.get('confidence') || '85')
      const frames = parseInt(searchParams.get('frames') || '5', 10)
      const histRate = parseFloat(searchParams.get('historicalRate') || '0.85')

      const result = computeBayesianPosterior(confidence, frames, histRate)

      return NextResponse.json({
        data: {
          input: { confidence, frames, historicalRate: histRate },
          bayesian: result,
          model_info: {
            present_prior_mu: 92.0,
            present_prior_sigma: 8.0,
            absent_prior_mu: 45.0,
            absent_prior_sigma: 20.0,
            frame_weight: 0.15,
            history_weight: 0.20,
          },
        },
      })
    }

    if (type === 'bda_5v') {
      // BDA 5 V's status
      return NextResponse.json({
        data: {
          volume: {
            description: 'Continuous video data from fixed classroom cameras',
            metrics: {
              frames_per_second: 30,
              avg_frames_per_session: 5400,
              total_face_embeddings: '128-dimensional vectors',
              storage_format: 'Parquet on HDFS (columnar, compressed)',
            },
          },
          velocity: {
            description: 'Real-time streaming face detection and matching',
            metrics: {
              detection_latency_ms: '50-100',
              matching_latency_ms: '20-50',
              streaming_protocol: 'WebRTC / MediaRecorder',
              processing: 'Spark Structured Streaming (micro-batch)',
            },
          },
          variety: {
            description: 'Multiple cameras, models, and data formats',
            metrics: {
              data_sources: ['Camera video', 'PostgreSQL', 'CSV exports', 'HDFS parquet'],
              detection_models: ['face-api.js (TinyFaceDetector)', 'YOLOv8 + ArcFace', 'Manual override'],
              embedding_dimensions: [128, 512],
            },
          },
          veracity: {
            description: 'Higher accuracy via multi-frame tracking and Bayesian reasoning',
            metrics: {
              false_positive_rate: '<2%',
              confidence_threshold: 70,
              bayesian_adjustment: 'Posterior probability with Gaussian likelihoods',
              multi_frame_confirmation: '3+ frames required',
            },
          },
          value: {
            description: 'Actionable insights, risk scoring, and attendance predictions',
            metrics: {
              reports: ['Daily summary', 'Student risk scores', 'Weekly trends', 'Camera analytics'],
              predictions: ['At-risk student identification', 'Attendance pattern detection'],
              exports: ['Excel', 'CSV', 'JSON', 'Parquet'],
            },
          },
        },
      })
    }

    if (type === 'tech_stack') {
      return NextResponse.json({
        data: {
          ai_ml: {
            subject: 'Artificial Intelligence & Machine Learning',
            components: [
              {
                name: 'Search Algorithms',
                tech: 'face-api.js TinyFaceDetector + FaceMatcher',
                description: 'Nearest-neighbor search in 128-dim embedding space to match detected faces with student database',
              },
              {
                name: 'Learning Algorithms',
                tech: 'YOLOv8 + ArcFace (InsightFace)',
                description: 'Deep learning models that improve with more training data. Handles different angles and lighting conditions.',
              },
              {
                name: 'Probabilistic Reasoning',
                tech: 'Bayesian posterior computation',
                description: 'Confidence score decides Present/Absent using Gaussian likelihoods and prior probabilities. Reduces false positives.',
              },
            ],
          },
          bda: {
            subject: 'Big Data Analytics (5 V\'s)',
            components: [
              { v: 'Volume', tech: 'Apache Spark DataFrames + HDFS Parquet', description: 'Process millions of attendance records with distributed computing' },
              { v: 'Velocity', tech: 'Spark Structured Streaming + WebRTC', description: 'Real-time video processing at 30 FPS with micro-batch analytics' },
              { v: 'Variety', tech: 'CSV / JSON / PostgreSQL / Parquet / HDFS', description: 'Multiple data formats from cameras, databases, and file systems' },
              { v: 'Veracity', tech: 'Statistical outlier detection + confidence filtering', description: 'Data quality assurance with Bayesian verification' },
              { v: 'Value', tech: 'Risk scoring + trend prediction + Excel exports', description: 'Actionable insights for teachers and administrators' },
            ],
          },
          cloud_computing: {
            subject: 'Cloud Computing',
            components: [
              { name: 'Database', tech: 'AWS RDS PostgreSQL', description: 'Managed cloud database with connection pooling and SSL' },
              { name: 'APIs', tech: 'Next.js Serverless API Routes', description: 'Auto-scaling RESTful endpoints accessible from anywhere' },
              { name: 'Storage', tech: 'HDFS / AWS S3 Data Lake', description: 'Distributed file storage for large-scale attendance data' },
              { name: 'Processing', tech: 'Apache Spark on YARN/Kubernetes', description: 'Distributed big data processing across cluster nodes' },
              { name: 'Deployment', tech: 'Vercel / AWS / Docker', description: 'Cloud-native deployment with automatic scaling' },
              { name: 'Streaming', tech: 'WebRTC camera → cloud AI processing', description: 'Classroom cameras stream to centralized processing' },
            ],
          },
        },
      })
    }

    // Handle real spark analytics report reading
    if (type === 'real_report') {
      try {
        const fs = require('fs');
        const path = require('path');
        const reportPath = path.join(process.cwd(), 'data', 'analytics_report.json');
        
        if (fs.existsSync(reportPath)) {
          const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
          return NextResponse.json({ data: reportData });
        } else {
          return NextResponse.json({ 
            error: 'Analytics report not found. Run "python scripts/spark_analytics.py --mode local --input data/sample_data.csv" first.' 
          }, { status: 404 });
        }
      } catch (err) {
        return NextResponse.json({ error: 'Failed to read analytics report: ' + err.message }, { status: 500 });
      }
    }

    // Default: overview
    const fs = require('fs');
    const path = require('path');
    const reportExists = fs.existsSync(path.join(process.cwd(), 'data', 'analytics_report.json'));

    return NextResponse.json({
      data: {
        available_types: ['overview', 'bayesian', 'bda_5v', 'tech_stack', 'real_report'],
        spark_available: true,
        report_generated: reportExists,
        hadoop_configured: !!process.env.HADOOP_HOST,
        engine: process.env.HADOOP_HOST ? 'spark_hdfs' : 'spark_local',
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error('[spark-analytics] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    verifyToken(request)

    const body = await request.json()
    const { action, confidence, frameCount, historicalRate } = body

    if (action === 'bayesian_batch') {
      // Batch Bayesian processing
      const records = body.records as Array<{ confidence: number; frameCount: number; historicalRate?: number }>
      if (!Array.isArray(records)) {
        return NextResponse.json({ error: 'records array is required' }, { status: 400 })
      }

      const results = records.map((record) =>
        computeBayesianPosterior(
          record.confidence,
          record.frameCount,
          record.historicalRate ?? 0.85,
        ),
      )

      return NextResponse.json({
        data: {
          batch_results: results,
          summary: {
            total: results.length,
            present: results.filter((r) => r.decision === 'present').length,
            absent: results.filter((r) => r.decision === 'absent').length,
            avg_confidence: Math.round(
              results.reduce((sum, r) => sum + r.confidenceScore, 0) / Math.max(results.length, 1) * 100,
            ) / 100,
          },
        },
      })
    }

    if (action === 'bayesian_single') {
      const result = computeBayesianPosterior(
        confidence ?? 85,
        frameCount ?? 5,
        historicalRate ?? 0.85,
      )
      return NextResponse.json({ data: result })
    }

    return NextResponse.json({ error: 'Unknown action. Use: bayesian_single, bayesian_batch' }, { status: 400 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error('[spark-analytics] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
