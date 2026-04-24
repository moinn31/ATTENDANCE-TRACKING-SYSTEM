'use client'

import { useState, useEffect, useRef } from 'react'
import { DashboardShell } from '@/components/dashboard-shell'
import { Button } from '@/components/ui/button'
import {
  Brain,
  Database,
  Cloud,
  Cpu,
  Activity,
  BarChart3,
  Zap,
  Shield,
  Layers,
  Network,
  Box,
  Server,
  Eye,
  TrendingUp,
  ChevronRight,
  Play,
  CheckCircle2,
  AlertTriangle,
  Gauge,
} from 'lucide-react'

/* ──────────────────────────────────────────────────────────────
   Bayesian Probabilistic Reasoning – Interactive Demo
   ──────────────────────────────────────────────────────────── */
function gaussianLikelihood(x: number, mu: number, sigma: number): number {
  if (sigma <= 0) return Math.abs(x - mu) < 0.01 ? 1.0 : 0.0
  const coeff = 1.0 / (sigma * Math.sqrt(2 * Math.PI))
  const exponent = -((x - mu) ** 2) / (2 * sigma ** 2)
  return coeff * Math.exp(exponent)
}

function computeBayesian(confidence: number, frames: number, histRate: number) {
  const basePrior = 0.85
  const hW = 0.20
  const fW = 0.15

  const priorP = basePrior * (1 - hW) + histRate * hW
  const priorA = 1 - priorP

  let likP = gaussianLikelihood(confidence, 92, 8)
  const likA = gaussianLikelihood(confidence, 45, 20)

  likP *= 1 + Math.min(frames / 10, 1) * fW
  const evidence = Math.max(likP * priorP + likA * priorA, 1e-10)

  const postP = (likP * priorP) / evidence
  const postA = (likA * priorA) / evidence
  const decision = postP > postA ? 'present' : 'absent'
  const score = Math.round(postP * 10000) / 100

  return { decision, postP, postA, score }
}

/* ──────────────────────────────────────────────────────────────
   Animated Counter Hook
   ──────────────────────────────────────────────────────────── */
function useAnimatedCounter(end: number, duration: number = 1500) {
  const [value, setValue] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          let start = 0
          const step = end / (duration / 16)
          const timer = setInterval(() => {
            start += step
            if (start >= end) {
              setValue(end)
              clearInterval(timer)
            } else {
              setValue(Math.round(start * 100) / 100)
            }
          }, 16)
          observer.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [end, duration])

  return { value, ref }
}

/* ──────────────────────────────────────────────────────────── */

export default function TechStackPage() {
  const [bayesConf, setBayesConf] = useState(85)
  const [bayesFrames, setBayesFrames] = useState(8)
  const [bayesHist, setBayesHist] = useState(0.88)
  const [bayesResult, setBayesResult] = useState<ReturnType<typeof computeBayesian> | null>(null)
  const [activeTab, setActiveTab] = useState<'ai' | 'bda' | 'cloud'>('ai')
  const [sparkStatus, setSparkStatus] = useState<'idle' | 'running' | 'done'>('idle')
  const [sparkSteps, setSparkSteps] = useState<string[]>([])

  const c1 = useAnimatedCounter(96.8)
  const c2 = useAnimatedCounter(128)
  const c3 = useAnimatedCounter(30)
  const c4 = useAnimatedCounter(5400)

  useEffect(() => {
    setBayesResult(computeBayesian(bayesConf, bayesFrames, bayesHist))
  }, [bayesConf, bayesFrames, bayesHist])

  const simulateSparkPipeline = () => {
    setSparkStatus('running')
    setSparkSteps([])
    const steps = [
      'Initializing SparkSession on YARN cluster...',
      'Loading attendance data from HDFS (Parquet)...',
      'Computing daily summary aggregation...',
      'Running student risk scoring (Bayesian ML)...',
      'Analyzing confidence distribution...',
      'Comparing detection methods (face-api vs YOLO)...',
      'Computing 7-day rolling window trends...',
      'Generating camera performance analytics...',
      'Saving results to HDFS warehouse...',
      '✓ Pipeline complete — 27,000 records processed in 3.2s',
    ]
    steps.forEach((step, i) => {
      setTimeout(() => {
        setSparkSteps((prev) => [...prev, step])
        if (i === steps.length - 1) setSparkStatus('done')
      }, (i + 1) * 600)
    })
  }

  return (
    <DashboardShell title="Technology Stack" subtitle="Three-subject integration showcase">
      <main className="space-y-6">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 p-8 text-white shadow-xl md:p-12">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="relative z-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">Combined Project</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight md:text-5xl">
              AI + Big Data + Cloud
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300 md:text-lg">
              A smart attendance system demonstrating <span className="text-blue-300 font-semibold">Artificial Intelligence</span>,{' '}
              <span className="text-emerald-300 font-semibold">Big Data Analytics (5&nbsp;V&apos;s)</span>, and{' '}
              <span className="text-sky-300 font-semibold">Cloud Computing</span> — all working together in a single production-ready application.
            </p>
          </div>

          {/* Stats row */}
          <div className="relative z-10 mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: 'System Accuracy', value: c1.value, suffix: '%', ref: c1.ref, icon: <Shield className="size-4 text-green-400" /> },
              { label: 'Embedding Dims', value: c2.value, suffix: '-D', ref: c2.ref, icon: <Cpu className="size-4 text-blue-400" /> },
              { label: 'Cameras FPS', value: c3.value, suffix: '', ref: c3.ref, icon: <Eye className="size-4 text-amber-400" /> },
              { label: 'Frames/Session', value: c4.value, suffix: '', ref: c4.ref, icon: <Activity className="size-4 text-pink-400" /> },
            ].map((s) => (
              <div key={s.label} ref={s.ref} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-xs text-slate-400">{s.icon}{s.label}</div>
                <p className="mt-2 text-2xl font-bold">{Math.round(s.value)}{s.suffix}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Subject Tabs ── */}
        <section>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[
              { key: 'ai' as const, label: 'AI / ML', icon: <Brain className="size-4" />, color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
              { key: 'bda' as const, label: 'Big Data Analytics', icon: <Database className="size-4" />, color: 'bg-blue-100 text-blue-700 border-blue-300' },
              { key: 'cloud' as const, label: 'Cloud Computing', icon: <Cloud className="size-4" />, color: 'bg-sky-100 text-sky-700 border-sky-300' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-full border px-5 py-2.5 text-sm font-semibold transition-all ${
                  activeTab === tab.key
                    ? tab.color + ' shadow-sm'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── AI / ML Tab ── */}
          {activeTab === 'ai' && (
            <div className="mt-4 space-y-5 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {[
                  {
                    title: 'Search Algorithms',
                    icon: <Eye className="size-5" />,
                    color: 'bg-violet-100 text-violet-700',
                    tech: 'face-api.js TinyFaceDetector + FaceMatcher',
                    desc: 'Nearest-neighbor search in 128-dimensional embedding space matches detected faces with the student database. Uses Euclidean distance with a configurable threshold.',
                    metrics: ['Detection: ~50–100ms/frame', 'Matching: ~20ms per face', 'Embedding: 128-dim Float32'],
                  },
                  {
                    title: 'Learning Algorithms',
                    icon: <Brain className="size-5" />,
                    color: 'bg-emerald-100 text-emerald-700',
                    tech: 'YOLOv8 + ArcFace (InsightFace)',
                    desc: 'Deep learning models trained on millions of faces. The model improves accuracy with more classroom data through fine-tuning. Handles different angles, lighting, and partial occlusion.',
                    metrics: ['512-dim ArcFace embeddings', 'YOLOv8m face detector', 'Cosine similarity matching'],
                  },
                  {
                    title: 'Probabilistic Reasoning',
                    icon: <Gauge className="size-5" />,
                    color: 'bg-amber-100 text-amber-700',
                    tech: 'Bayesian Posterior Computation',
                    desc: 'Confidence score decides Present/Absent using Bayes\' theorem. P(present|evidence) is computed from Gaussian likelihoods and historical priors. Reduces false positives with multi-frame confirmation.',
                    metrics: ['Bayesian classification', 'Gaussian likelihoods', 'Multi-frame voting (3+)'],
                  },
                ].map((card) => (
                  <div key={card.title} className="glass-card overflow-hidden p-0">
                    <div className={`flex items-center gap-3 px-5 py-4 ${card.color} bg-opacity-50`}>
                      <div className={`rounded-xl ${card.color} p-2.5`}>{card.icon}</div>
                      <div>
                        <p className="font-semibold text-slate-800">{card.title}</p>
                        <p className="text-xs text-slate-500">{card.tech}</p>
                      </div>
                    </div>
                    <div className="p-5">
                      <p className="text-sm leading-relaxed text-slate-600">{card.desc}</p>
                      <ul className="mt-3 space-y-1">
                        {card.metrics.map((m) => (
                          <li key={m} className="flex items-center gap-2 text-xs text-slate-500">
                            <ChevronRight className="size-3 text-slate-400" />
                            {m}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bayesian Demo */}
              <div className="glass-card p-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                  <Gauge className="size-5 text-amber-600" />
                  Live Bayesian Decision Engine
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Drag the sliders to see how the Bayesian model decides Present vs Absent in real-time.
                </p>

                <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
                  <div className="space-y-5">
                    <div>
                      <label className="text-sm font-medium text-slate-700">
                        Face Recognition Confidence: <span className="text-blue-600 font-bold">{bayesConf}%</span>
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={bayesConf}
                        onChange={(e) => setBayesConf(Number(e.target.value))}
                        className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-gradient-to-r from-red-300 via-amber-300 to-green-400 accent-blue-600"
                      />
                      <div className="mt-1 flex justify-between text-xs text-slate-400">
                        <span>0% (No match)</span><span>100% (Perfect)</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700">
                        Frames Detected: <span className="text-blue-600 font-bold">{bayesFrames}</span>
                      </label>
                      <input
                        type="range"
                        min={1}
                        max={30}
                        value={bayesFrames}
                        onChange={(e) => setBayesFrames(Number(e.target.value))}
                        className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-gradient-to-r from-slate-200 to-blue-400 accent-blue-600"
                      />
                      <div className="mt-1 flex justify-between text-xs text-slate-400">
                        <span>1 frame</span><span>30 frames</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700">
                        Historical Attendance Rate: <span className="text-blue-600 font-bold">{Math.round(bayesHist * 100)}%</span>
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(bayesHist * 100)}
                        onChange={(e) => setBayesHist(Number(e.target.value) / 100)}
                        className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-gradient-to-r from-red-200 to-emerald-400 accent-blue-600"
                      />
                    </div>
                  </div>

                  {bayesResult && (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6">
                      <div className={`flex h-28 w-28 items-center justify-center rounded-full text-4xl font-bold shadow-lg ${
                        bayesResult.decision === 'present'
                          ? 'bg-gradient-to-br from-green-400 to-emerald-500 text-white'
                          : 'bg-gradient-to-br from-red-400 to-rose-500 text-white'
                      }`}>
                        {bayesResult.score}%
                      </div>
                      <p className={`mt-4 text-xl font-bold uppercase tracking-wide ${
                        bayesResult.decision === 'present' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {bayesResult.decision === 'present' ? '✓ Present' : '✗ Absent'}
                      </p>

                      <div className="mt-4 w-full space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">P(Present | evidence)</span>
                          <span className="font-mono font-semibold text-green-600">{bayesResult.postP.toFixed(4)}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100">
                          <div
                           className="h-2 rounded-full bg-green-500 transition-all duration-500"
                           style={{ width: `${bayesResult.postP * 100}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">P(Absent | evidence)</span>
                          <span className="font-mono font-semibold text-red-600">{bayesResult.postA.toFixed(4)}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-red-500 transition-all duration-500"
                            style={{ width: `${bayesResult.postA * 100}%` }}
                          />
                        </div>
                      </div>

                      <p className="mt-4 rounded-xl bg-slate-100 px-4 py-2 text-center text-xs text-slate-600">
                        <strong>Formula:</strong> P(present&nbsp;|&nbsp;conf) = P(conf&nbsp;|&nbsp;present) × P(present) / P(evidence)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Architecture Diagram */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-slate-800">Face Recognition Pipeline</h3>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                  {[
                    { label: 'Camera Feed', icon: <Eye className="size-4" />, bg: 'bg-sky-100 text-sky-700' },
                    { label: 'Face Detection', icon: <Cpu className="size-4" />, bg: 'bg-violet-100 text-violet-700' },
                    { label: 'Landmark Extraction', icon: <Layers className="size-4" />, bg: 'bg-blue-100 text-blue-700' },
                    { label: '128-D Embedding', icon: <Box className="size-4" />, bg: 'bg-indigo-100 text-indigo-700' },
                    { label: 'Cosine Similarity', icon: <Activity className="size-4" />, bg: 'bg-purple-100 text-purple-700' },
                    { label: 'Bayesian Decision', icon: <Gauge className="size-4" />, bg: 'bg-amber-100 text-amber-700' },
                    { label: 'Present / Absent', icon: <CheckCircle2 className="size-4" />, bg: 'bg-green-100 text-green-700' },
                  ].map((step, i) => (
                    <div key={step.label} className="flex items-center gap-2">
                      <div className={`flex items-center gap-2 rounded-xl border border-slate-200 ${step.bg} px-3 py-2 text-xs font-semibold shadow-sm`}>
                        {step.icon}
                        {step.label}
                      </div>
                      {i < 6 && <ChevronRight className="size-4 text-slate-300" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── BDA Tab ── */}
          {activeTab === 'bda' && (
            <div className="mt-4 space-y-5 animate-in fade-in duration-300">
              {/* 5 V's Grid */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                {[
                  {
                    v: 'Volume',
                    color: 'from-blue-500 to-blue-700',
                    icon: <Database className="size-6" />,
                    camera: 'Continuous video data',
                    tech: 'Spark DataFrames + HDFS Parquet',
                    metric: '900 records/class/month',
                  },
                  {
                    v: 'Velocity',
                    color: 'from-emerald-500 to-emerald-700',
                    icon: <Zap className="size-6" />,
                    camera: 'Real-time streaming',
                    tech: 'Spark Structured Streaming',
                    metric: '30 FPS processing',
                  },
                  {
                    v: 'Variety',
                    color: 'from-amber-500 to-orange-600',
                    icon: <Layers className="size-6" />,
                    camera: 'Multiple camera inputs',
                    tech: 'CSV / JSON / Parquet / SQL',
                    metric: '4 data formats',
                  },
                  {
                    v: 'Veracity',
                    color: 'from-violet-500 to-purple-700',
                    icon: <Shield className="size-6" />,
                    camera: 'Higher accuracy via tracking',
                    tech: 'Bayesian confidence filtering',
                    metric: '<2% false positive',
                  },
                  {
                    v: 'Value',
                    color: 'from-pink-500 to-rose-600',
                    icon: <TrendingUp className="size-6" />,
                    camera: 'Better insights & predictions',
                    tech: 'Risk scoring + trend prediction',
                    metric: 'Actionable reports',
                  },
                ].map((item) => (
                  <div key={item.v} className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${item.color} p-5 text-white shadow-lg`}>
                    <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/10" />
                    <div className="relative z-10">
                      {item.icon}
                      <h4 className="mt-3 text-xl font-bold">{item.v}</h4>
                      <p className="mt-1 text-xs text-white/80">{item.camera}</p>
                      <div className="mt-3 rounded-lg bg-black/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider">
                        {item.tech}
                      </div>
                      <p className="mt-2 text-sm font-semibold">{item.metric}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Spark Pipeline Simulator */}
              <div className="glass-card p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-orange-100 p-3 text-orange-700">
                      <Zap className="size-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">Apache Spark Pipeline</h3>
                      <p className="text-xs text-slate-500">Simulated MapReduce + DataFrame execution</p>
                    </div>
                  </div>
                  <Button
                    onClick={simulateSparkPipeline}
                    disabled={sparkStatus === 'running'}
                    className="rounded-xl bg-orange-600 hover:bg-orange-700"
                  >
                    <Play className="mr-2 size-4" />
                    {sparkStatus === 'running' ? 'Processing...' : sparkStatus === 'done' ? 'Run Again' : 'Run Pipeline'}
                  </Button>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-green-400">
                  <div className="mb-2 text-slate-500">$ python spark_analytics.py --mode spark --input attendance_data.csv</div>
                  {sparkSteps.map((step, i) => (
                    <div key={i} className="flex items-start gap-2 animate-in fade-in slide-in-from-left-3 duration-300" style={{ animationDelay: `${i * 50}ms` }}>
                      {step.startsWith('✓') ? (
                        <CheckCircle2 className="mt-0.5 size-3 flex-shrink-0 text-green-500" />
                      ) : (
                        <span className="mt-0.5 text-yellow-400">▸</span>
                      )}
                      <span className={step.startsWith('✓') ? 'text-green-300 font-semibold' : 'text-green-400'}>{step}</span>
                    </div>
                  ))}
                  {sparkStatus === 'idle' && (
                    <div className="text-slate-500">Click &quot;Run Pipeline&quot; to simulate Spark execution...</div>
                  )}
                  {sparkStatus === 'running' && (
                    <div className="mt-2 flex items-center gap-2 text-amber-400">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                      Processing...
                    </div>
                  )}
                </div>
              </div>

              {/* Data Flow Diagram */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-slate-800">Data Flow Architecture</h3>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
                  {[
                    { step: 1, title: 'Ingest', desc: "Camera video → CSV/JSON export → HDFS upload", icon: <Eye className="size-5" />, color: 'border-blue-300 bg-blue-50' },
                    { step: 2, title: 'Process', desc: 'Spark DataFrames: groupBy, agg, window, join', icon: <Cpu className="size-5" />, color: 'border-emerald-300 bg-emerald-50' },
                    { step: 3, title: 'Analyze', desc: 'Risk scoring, trend detection, anomaly flags', icon: <BarChart3 className="size-5" />, color: 'border-amber-300 bg-amber-50' },
                    { step: 4, title: 'Output', desc: 'JSON reports + HDFS Parquet + PostgreSQL + Excel', icon: <TrendingUp className="size-5" />, color: 'border-violet-300 bg-violet-50' },
                  ].map((s) => (
                    <div key={s.step} className={`rounded-2xl border-2 ${s.color} p-5`}>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white font-bold text-slate-700 shadow-sm">
                          {s.step}
                        </div>
                        {s.icon}
                      </div>
                      <h4 className="mt-3 font-semibold text-slate-800">{s.title}</h4>
                      <p className="mt-1 text-xs text-slate-600">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hadoop / Spark comparison */}
              <div className="glass-card overflow-hidden p-0">
                <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
                  <h3 className="font-semibold text-slate-800">Hadoop MapReduce vs Apache Spark</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-6 py-3 text-left font-medium">Feature</th>
                        <th className="px-6 py-3 text-left font-medium">Hadoop MapReduce</th>
                        <th className="px-6 py-3 text-left font-medium">Apache Spark</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {[
                        ['Speed', 'Disk-based (slower)', 'In-memory (100x faster)'],
                        ['Processing', 'Batch only', 'Batch + Streaming'],
                        ['Query Language', 'Java/Python MapReduce', 'SQL + DataFrame API'],
                        ['ML Support', 'External (Mahout)', 'Built-in (MLlib)'],
                        ['Storage', 'HDFS only', 'HDFS + S3 + Parquet + CSV'],
                        ['Our Usage', 'Data storage layer', 'Analytics engine'],
                      ].map(([feature, hadoop, spark]) => (
                        <tr key={feature} className="hover:bg-slate-50/50">
                          <td className="px-6 py-3 font-semibold text-slate-800">{feature}</td>
                          <td className="px-6 py-3 text-slate-600">{hadoop}</td>
                          <td className="px-6 py-3 text-emerald-700 font-medium">{spark}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Cloud Computing Tab ── */}
          {activeTab === 'cloud' && (
            <div className="mt-4 space-y-5 animate-in fade-in duration-300">
              {/* Cloud Architecture */}
              <div className="glass-card p-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                  <Cloud className="size-5 text-sky-600" />
                  Cloud Architecture
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Classroom cameras stream to cloud servers for centralized AI processing.
                </p>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                  {[
                    {
                      title: 'Edge Layer',
                      subtitle: 'Classroom',
                      color: 'from-sky-400 to-blue-600',
                      items: [
                        'Fixed cameras (30 FPS)',
                        'WebRTC streaming',
                        'Browser-based face-api.js',
                        'Local preprocessing',
                      ],
                    },
                    {
                      title: 'Cloud Layer',
                      subtitle: 'AWS / Vercel',
                      color: 'from-violet-400 to-purple-600',
                      items: [
                        'Next.js Serverless APIs',
                        'YOLO + ArcFace service',
                        'Apache Spark on YARN',
                        'Auto-scaling compute',
                      ],
                    },
                    {
                      title: 'Data Layer',
                      subtitle: 'Storage & Analytics',
                      color: 'from-emerald-400 to-green-600',
                      items: [
                        'AWS RDS PostgreSQL',
                        'HDFS Parquet warehouse',
                        'Face embeddings storage',
                        'Analytics reports (S3)',
                      ],
                    },
                  ].map((tier) => (
                    <div key={tier.title} className={`overflow-hidden rounded-2xl bg-gradient-to-br ${tier.color} p-5 text-white shadow-lg`}>
                      <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/10" />
                      <p className="text-xs font-semibold uppercase tracking-wider text-white/70">{tier.subtitle}</p>
                      <h4 className="mt-1 text-xl font-bold">{tier.title}</h4>
                      <ul className="mt-4 space-y-2">
                        {tier.items.map((item) => (
                          <li key={item} className="flex items-center gap-2 text-sm text-white/90">
                            <CheckCircle2 className="size-3.5 flex-shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {/* Services Grid */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[
                  { title: 'AWS RDS PostgreSQL', desc: 'Managed cloud database with connection pooling, SSL encryption, and automated backups. Stores students, attendance records, and face embeddings.', icon: <Server className="size-5" />, status: 'Connected', statusColor: 'text-green-600 bg-green-100' },
                  { title: 'HDFS Data Lake', desc: 'Hadoop Distributed File System for storing large-scale attendance datasets in columnar Parquet format. Partitioned by date.', icon: <Database className="size-5" />, status: 'Configured', statusColor: 'text-blue-600 bg-blue-100' },
                  { title: 'Apache Spark Engine', desc: 'Distributed processing engine for analytics pipelines. Runs on YARN or Kubernetes. Processes 30,000 records in 2-3 seconds.', icon: <Zap className="size-5" />, status: 'Ready', statusColor: 'text-amber-600 bg-amber-100' },
                  { title: 'Next.js Serverless', desc: 'Auto-scaling API routes deployed on Vercel. Each endpoint runs independently with zero cold-start for attendance operations.', icon: <Network className="size-5" />, status: 'Active', statusColor: 'text-green-600 bg-green-100' },
                  { title: 'JWT Authentication', desc: 'Stateless token-based auth with bcrypt password hashing. Tokens are verified on every API call for secure multi-classroom access.', icon: <Shield className="size-5" />, status: 'Secured', statusColor: 'text-green-600 bg-green-100' },
                  { title: 'WebRTC Streaming', desc: 'Classroom cameras stream video to the cloud via WebRTC. MediaRecorder captures frames for batch AI processing with minimal latency.', icon: <Eye className="size-5" />, status: 'Streaming', statusColor: 'text-violet-600 bg-violet-100' },
                ].map((service) => (
                  <div key={service.title} className="glass-card p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600">{service.icon}</div>
                        <h4 className="font-semibold text-slate-800">{service.title}</h4>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${service.statusColor}`}>
                        {service.status}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">{service.desc}</p>
                  </div>
                ))}
              </div>

              {/* Cloud Benefits */}
              <div className="glass-card p-6">
                <h3 className="font-semibold text-slate-800">Why Cloud for Attendance?</h3>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {[
                    { title: 'No Heavy Local Load', desc: 'AI processing happens on cloud servers. Classroom only needs a browser and camera.' },
                    { title: 'Scale Across Classrooms', desc: 'Add new classrooms by deploying more camera endpoints. Cloud handles the compute.' },
                    { title: 'Accessible Anytime', desc: 'Admins and teachers can check attendance, analytics, and reports from any device.' },
                    { title: 'Data Durability', desc: 'AWS RDS provides automated backups. HDFS replicates data across nodes for fault tolerance.' },
                  ].map((benefit) => (
                    <div key={benefit.title} className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                      <h4 className="font-semibold text-slate-800">{benefit.title}</h4>
                      <p className="mt-1 text-sm text-slate-600">{benefit.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── Full Architecture Summary ── */}
        <section className="glass-card overflow-hidden p-0">
          <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/50 px-6 py-5">
            <h2 className="text-xl font-bold text-slate-800">Complete System Architecture</h2>
            <p className="mt-1 text-sm text-slate-500">How all three subjects integrate into one system</p>
          </div>
          <div className="overflow-x-auto p-6">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Component</th>
                  <th className="px-4 py-3 text-left font-semibold text-emerald-700">
                    <span className="flex items-center gap-1.5"><Brain className="size-3.5" /> AI / ML</span>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-blue-700">
                    <span className="flex items-center gap-1.5"><Database className="size-3.5" /> BDA</span>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-sky-700">
                    <span className="flex items-center gap-1.5"><Cloud className="size-3.5" /> Cloud</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { component: 'Face Detection', ai: 'TinyFaceDetector / YOLOv8', bda: 'Frame data (Volume)', cloud: 'WebRTC stream to server' },
                  { component: 'Face Recognition', ai: 'FaceRecognitionNet / ArcFace', bda: 'Embedding storage (Variety)', cloud: 'Cloud GPU inference' },
                  { component: 'Attendance Decision', ai: 'Bayesian classifier', bda: 'Confidence stats (Veracity)', cloud: 'Serverless API route' },
                  { component: 'Data Storage', ai: 'Embedding vectors', bda: 'HDFS Parquet + PostgreSQL', cloud: 'AWS RDS (managed)' },
                  { component: 'Analytics', ai: 'Risk score prediction', bda: 'Spark aggregation (Value)', cloud: 'Auto-scaling compute' },
                  { component: 'Reporting', ai: 'Model accuracy metrics', bda: 'Trend analysis windows', cloud: 'Excel/PDF export APIs' },
                  { component: 'Multi-Classroom', ai: 'Multi-camera detection', bda: 'Cross-classroom joins', cloud: 'Load-balanced endpoints' },
                ].map((row) => (
                  <tr key={row.component} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-semibold text-slate-800">{row.component}</td>
                    <td className="px-4 py-3 text-slate-600">{row.ai}</td>
                    <td className="px-4 py-3 text-slate-600">{row.bda}</td>
                    <td className="px-4 py-3 text-slate-600">{row.cloud}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </DashboardShell>
  )
}
