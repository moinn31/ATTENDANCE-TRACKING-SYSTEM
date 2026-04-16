'use client'

import { useEffect, useState } from 'react'
import { DashboardShell } from '@/components/dashboard-shell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

const SETTINGS_STORAGE_KEY = 'ats.settings'

type AppSettings = {
  autoMarkAbsent: boolean
  enableOfflineQueue: boolean
  confidenceThreshold: string
  defaultClassName: string
  defaultSubjectName: string
  dayStartTime: string
  dayEndTime: string
}

const DEFAULT_SETTINGS: AppSettings = {
  autoMarkAbsent: false,
  enableOfflineQueue: true,
  confidenceThreshold: '90',
  defaultClassName: '',
  defaultSubjectName: '',
  dayStartTime: '09:00',
  dayEndTime: '16:00',
}

function loadSavedSettings(): AppSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) {
      return DEFAULT_SETTINGS
    }

    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setSettings(loadSavedSettings())
    setLoading(false)
  }, [])

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = () => {
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
      setSaved(true)
    } catch {
      setSaved(false)
    }
  }

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS)
    setSaved(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading settings...</p>
      </div>
    )
  }

  return (
    <DashboardShell title="Settings" subtitle="Configure attendance, recognition, and defaults">
      <main className="space-y-5">
        <section className="glass-card p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground md:text-3xl">System Settings</h1>
              <p className="mt-1 text-sm text-muted-foreground">Manage daily attendance behavior and scanning defaults for this browser.</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Local Profile</Badge>
              <Badge className="bg-[#2b5c9e] text-white hover:bg-[#254f87]">PostgreSQL</Badge>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="glass-card py-0">
            <CardHeader>
              <CardTitle>Attendance Rules</CardTitle>
              <CardDescription>Default behavior for mark, queue, and schedule.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pb-6">
              <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/70 p-3">
                <div>
                  <p className="text-sm font-medium">Auto-mark absent at end of day</p>
                  <p className="text-xs text-muted-foreground">Students without check-in are marked absent automatically.</p>
                </div>
                <Switch
                  checked={settings.autoMarkAbsent}
                  onCheckedChange={(checked) => updateSetting('autoMarkAbsent', checked)}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/70 p-3">
                <div>
                  <p className="text-sm font-medium">Enable offline queue</p>
                  <p className="text-xs text-muted-foreground">Queue scans locally when the network is unstable.</p>
                </div>
                <Switch
                  checked={settings.enableOfflineQueue}
                  onCheckedChange={(checked) => updateSetting('enableOfflineQueue', checked)}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dayStartTime">Day start time</Label>
                  <Input
                    id="dayStartTime"
                    type="time"
                    value={settings.dayStartTime}
                    onChange={(event) => updateSetting('dayStartTime', event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dayEndTime">Day end time</Label>
                  <Input
                    id="dayEndTime"
                    type="time"
                    value={settings.dayEndTime}
                    onChange={(event) => updateSetting('dayEndTime', event.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card py-0">
            <CardHeader>
              <CardTitle>Recognition Defaults</CardTitle>
              <CardDescription>Set confidence threshold and optional prefill values for any class or subject.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pb-6">
              <div className="space-y-2">
                <Label>Face confidence threshold</Label>
                <Select
                  value={settings.confidenceThreshold}
                  onValueChange={(value) => updateSetting('confidenceThreshold', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose threshold" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="80">80% (lenient)</SelectItem>
                    <SelectItem value="85">85%</SelectItem>
                    <SelectItem value="90">90% (recommended)</SelectItem>
                    <SelectItem value="95">95% (strict)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultClassName">Class prefill (optional)</Label>
                <Input
                  id="defaultClassName"
                  value={settings.defaultClassName}
                  onChange={(event) => updateSetting('defaultClassName', event.target.value)}
                  placeholder="Example: Any class, section, or batch"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultSubjectName">Subject prefill (optional)</Label>
                <Input
                  id="defaultSubjectName"
                  value={settings.defaultSubjectName}
                  onChange={(event) => updateSetting('defaultSubjectName', event.target.value)}
                  placeholder="Example: Any subject"
                />
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="glass-card flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-muted-foreground">
            Settings are stored in this browser profile and can be expanded to database-backed preferences later.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleReset}>Reset Defaults</Button>
            <Button className="bg-[#2b5c9e] hover:bg-[#254f87]" onClick={handleSave}>Save Settings</Button>
          </div>
          {saved && <p className="w-full text-sm font-medium text-emerald-600">Settings saved successfully.</p>}
        </section>
      </main>
    </DashboardShell>
  )
}
