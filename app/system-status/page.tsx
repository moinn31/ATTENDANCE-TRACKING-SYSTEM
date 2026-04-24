'use client'

import { useEffect, useState } from 'react'
import { DashboardShell } from '@/components/dashboard-shell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Database, Cpu, Cloud, Layers } from 'lucide-react'

type HealthStatus = {
  status: 'connected' | 'error' | 'offline' | 'installed' | 'not_found' | 'unknown'
  message: string
  details?: any
  serverTime?: string
  versionInfo?: string
}

type HealthData = {
  database: HealthStatus
  faceRecognition: HealthStatus
  spark: HealthStatus
  hadoop: HealthStatus
}

export default function SystemStatusPage() {
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/health')
      if (response.ok) {
        const result = await response.json()
        setData(result)
        setLastUpdated(new Date())
      }
    } catch (err) {
      console.error('Failed to fetch status:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case 'connected':
      case 'installed':
        return <Badge className="bg-green-500/15 text-green-700 border-green-500/20">Operational</Badge>
      case 'error':
      case 'offline':
        return <Badge className="bg-red-500/15 text-red-700 border-red-500/20">Critical</Badge>
      case 'not_found':
        return <Badge className="bg-yellow-500/15 text-yellow-700 border-yellow-500/20">Missing</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'connected':
      case 'installed':
        return <CheckCircle2 className="size-5 text-green-500" />
      case 'error':
      case 'offline':
        return <XCircle className="size-5 text-red-500" />
      case 'not_found':
        return <AlertCircle className="size-5 text-yellow-500" />
      default:
        return <RefreshCw className="size-5 text-muted-foreground animate-spin" />
    }
  }

  return (
    <DashboardShell 
      title="System Status" 
      subtitle="Monitor your core infrastructure and service health"
      headerActions={
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchStatus} 
          disabled={loading}
          className="rounded-full gap-2"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        {/* AWS RDS Database */}
        <Card className="border-border/60 shadow-sm overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <Cloud className="size-24" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Database className="size-5 text-blue-500" />
                AWS RDS Database
              </CardTitle>
              <CardDescription>PostgreSQL Storage Layer</CardDescription>
            </div>
            <StatusIcon status={data?.database.status || 'unknown'} />
          </CardHeader>
          <CardContent>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Status</span>
                <StatusBadge status={data?.database.status || 'unknown'} />
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs font-mono break-all">{data?.database.message || 'Connecting...'}</p>
              </div>
              {data?.database.serverTime && (
                <p className="text-xs text-muted-foreground">Server Time: {new Date(data.database.serverTime).toLocaleString()}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* YOLO Service */}
        <Card className="border-border/60 shadow-sm overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <Cpu className="size-24" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Cpu className="size-5 text-purple-500" />
                AI Inference Service
              </CardTitle>
              <CardDescription>YOLOv8 + ArcFace Backend</CardDescription>
            </div>
            <StatusIcon status={data?.faceRecognition.status || 'unknown'} />
          </CardHeader>
          <CardContent>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Status</span>
                <StatusBadge status={data?.faceRecognition.status || 'unknown'} />
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs font-mono break-all line-clamp-2">{data?.faceRecognition.message || 'Checking service...'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Apache Spark */}
        <Card className="border-border/60 shadow-sm overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <Layers className="size-24" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Layers className="size-5 text-orange-500" />
                Apache Spark
              </CardTitle>
              <CardDescription>Big Data Processing Engine</CardDescription>
            </div>
            <StatusIcon status={data?.spark.status || 'unknown'} />
          </CardHeader>
          <CardContent>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Status</span>
                <StatusBadge status={data?.spark.status || 'unknown'} />
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs font-mono line-clamp-3">{data?.spark.message || 'Verifying installation...'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hadoop / HDFS */}
        <Card className="border-border/60 shadow-sm overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <Cloud className="size-24" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Cloud className="size-5 text-yellow-600" />
                Hadoop / HDFS
              </CardTitle>
              <CardDescription>Distributed File System</CardDescription>
            </div>
            <StatusIcon status={data?.hadoop.status || 'unknown'} />
          </CardHeader>
          <CardContent>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Status</span>
                <StatusBadge status={data?.hadoop.status || 'unknown'} />
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs font-mono line-clamp-3">{data?.hadoop.message || 'Verifying installation...'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-12 flex flex-col items-center justify-center text-center text-muted-foreground">
        <p className="text-sm">Last system scan: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'}</p>
        <p className="text-xs mt-1 italic">Note: AI Inference service is optional; the system will fallback to browser-based face-api.js if offline.</p>
      </div>
    </DashboardShell>
  )
}
