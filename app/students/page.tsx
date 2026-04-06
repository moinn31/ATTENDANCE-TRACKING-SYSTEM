'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDatabaseActionError, isMissingSessionError } from '@/lib/supabase/auth-errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import FaceEnrollmentModal from '@/components/face-enrollment-modal'
import { DashboardShell } from '@/components/dashboard-shell'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Users, UserRound, ShieldCheck, Clock3 } from 'lucide-react'

interface Student {
  id: string
  name: string
  roll_number: string | null
  face_enrolled: boolean
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newStudent, setNewStudent] = useState({ name: '', roll_number: '' })
  const [enrollingStudentId, setEnrollingStudentId] = useState<string | null>(null)
  const [enrollingStudentName, setEnrollingStudentName] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const fetchStudents = async () => {
    try {
      const response = await fetch('/api/students', { cache: 'no-store' })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load students')
      }

      setStudents(payload.data || [])
    } catch (err) {
      console.error('[v0] Error fetching students:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch students')
    }
  }

  // Check authentication
  useEffect(() => {
    const getUser = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser()
        
        if (error && !isMissingSessionError(error.message)) {
          console.error('Auth error:', error.message)
          await supabase.auth.signOut()
          setLoading(false)
          router.replace('/auth/login')
          return
        }

        if (!user) {
          setLoading(false)
          router.replace('/auth/login')
          return
        }

        setUser(user)
        setLoading(false)
      } catch (error) {
        console.error('Failed to get user:', error)
        await supabase.auth.signOut()
        setLoading(false)
        router.replace('/auth/login')
      }
    }

    void getUser()
  }, [router, supabase])

  useEffect(() => {
    if (!loading) {
      fetchStudents()
    }
  }, [loading])

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newStudent.name || !newStudent.roll_number) {
      alert('Please fill in all fields')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const { data, error: insertError } = await supabase
        .from('students')
        .insert({
          name: newStudent.name.trim(),
          roll_number: newStudent.roll_number.trim(),
        })
        .select('id, name, roll_number')
        .single()

      if (insertError || !data) {
        throw new Error(formatDatabaseActionError(insertError?.message || 'Failed to add student'))
      }

      setStudents((prev) => [
        {
          id: data.id,
          name: data.name,
          roll_number: data.roll_number,
          face_enrolled: false,
        },
        ...prev,
      ])
      setNewStudent({ name: '', roll_number: '' })
      setShowAddForm(false)
    } catch (err) {
      console.error('[v0] Error adding student:', err)
      setError(err instanceof Error ? err.message : 'Failed to add student')
    } finally {
      setSaving(false)
    }
  }

  const deleteStudent = async (id: string) => {
    try {
      setSaving(true)
      setError(null)

      const { error: deleteError } = await supabase.from('students').delete().eq('id', id)

      if (deleteError) {
        throw new Error(formatDatabaseActionError(deleteError.message || 'Failed to delete student'))
      }

      setStudents((prev) => prev.filter((student) => student.id !== id))
    } catch (err) {
      console.error('[v0] Error deleting student:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete student')
    } finally {
      setSaving(false)
    }
  }

  const handleStartEnrollment = (studentId: string, studentName: string) => {
    setEnrollingStudentId(studentId)
    setEnrollingStudentName(studentName)
  }

  const handleEnrollmentComplete = async (faceData: any) => {
    try {
      setSaving(true)
      setError(null)

      const serializedDescriptor = JSON.stringify(faceData.descriptor)

      const { error: deleteOldError } = await supabase
        .from('face_embeddings')
        .delete()
        .eq('student_id', faceData.studentId)

      if (deleteOldError) {
        throw new Error(formatDatabaseActionError(deleteOldError.message || 'Failed to clear previous face enrollment'))
      }

      const { error: insertError } = await supabase.from('face_embeddings').insert({
        student_id: faceData.studentId,
        embedding_vector: serializedDescriptor,
      })

      if (insertError) {
        throw new Error(formatDatabaseActionError(insertError.message || 'Failed to save face enrollment'))
      }

      setStudents((prev) =>
        prev.map((student) =>
          student.id === faceData.studentId ? { ...student, face_enrolled: true } : student,
        ),
      )

      setEnrollingStudentId(null)
      setEnrollingStudentName('')
    } catch (err) {
      console.error('[v0] Error saving face data:', err)
      setError(err instanceof Error ? err.message : 'Failed to save face enrollment')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <DashboardShell title="Students" subtitle="Roster and face enrollment management">
      <main className="space-y-6">
        <section className="glass-card p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Roster Management</p>
              <h1 className="mt-2 text-3xl font-semibold text-foreground md:text-4xl">Student Management</h1>
              <p className="mt-2 text-sm text-muted-foreground">Maintain your class roster and keep face enrollment records up to date.</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowAddForm(!showAddForm)} className="gap-2 rounded-xl">
                + Add Student
              </Button>
              <Link href="/">
                <Button variant="outline" className="rounded-xl border-border/70 bg-card/80">Back</Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card p-6">
            <p className="text-muted-foreground text-xs uppercase tracking-wider">Total Students</p>
            <p className="text-3xl font-semibold text-foreground mt-2">{students.length}</p>
          </div>
          <div className="glass-card p-6">
            <p className="text-muted-foreground text-xs uppercase tracking-wider">Face Enrolled</p>
            <p className="text-3xl font-semibold text-foreground mt-2">{students.filter((s) => s.face_enrolled).length}</p>
          </div>
          <div className="glass-card p-6">
            <p className="text-muted-foreground text-xs uppercase tracking-wider">Pending Enrollment</p>
            <p className="text-3xl font-semibold text-foreground mt-2">{students.filter((s) => !s.face_enrolled).length}</p>
          </div>
        </section>

        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded text-destructive">
            {error}
          </div>
        )}

        <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
          <DialogContent className="w-[min(98vw,1360px)] max-w-none overflow-hidden rounded-[2rem] border-0 p-0 shadow-[0_35px_110px_rgba(15,23,42,0.42)]">
            <div className="grid min-h-[720px] lg:grid-cols-[minmax(760px,1.35fr)_minmax(420px,0.85fr)]">
              <div className="overflow-y-auto bg-white p-6 md:p-8 lg:p-10">
                <DialogHeader className="text-left">
                  <DialogTitle className="text-2xl font-semibold text-slate-800 md:text-3xl">Add Students</DialogTitle>
                  <DialogDescription className="max-w-xl text-sm text-slate-500 md:text-base">
                    Add a student to the roster, then enroll their face from the next step.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleAddStudent} className="mt-6 space-y-5">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Student Name</label>
                      <Input
                        placeholder="Enter full name"
                        value={newStudent.name}
                        onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                        required
                        className="h-11 rounded-xl border-slate-200 bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Roll Number</label>
                      <Input
                        placeholder="Enter roll number"
                        value={newStudent.roll_number}
                        onChange={(e) => setNewStudent({ ...newStudent, roll_number: e.target.value })}
                        required
                        className="h-11 rounded-xl border-slate-200 bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Email Address</label>
                      <Input
                        placeholder="Optional email"
                        type="email"
                        className="h-11 rounded-xl border-slate-200 bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Section</label>
                      <Input
                        placeholder="Example: A / B / C"
                        className="h-11 rounded-xl border-slate-200 bg-white"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-[#2b5c9e] p-3 text-white">
                        <UserRound className="size-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Enrollment flow</p>
                        <p className="text-xs text-slate-500">After saving, open the face enrollment modal to capture embeddings.</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <Button type="button" variant="outline" onClick={() => setShowAddForm(false)} className="rounded-xl border-slate-200 bg-white">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saving} className="rounded-xl bg-[#2b5c9e] px-6 hover:bg-[#254f87]">
                      {saving ? 'Saving...' : 'Save Student'}
                    </Button>
                  </div>
                </form>
              </div>

              <div className="overflow-y-auto bg-[#2b5c9e] p-6 text-white md:p-8 lg:p-10">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-white/15 p-3 text-white">
                    <Users className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/70">Roster panel</p>
                    <h3 className="text-2xl font-semibold md:text-3xl">Student preview</h3>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-white/12 p-4 backdrop-blur">
                    <p className="text-xs text-white/70">Total</p>
                    <p className="mt-1 text-2xl font-semibold">{students.length}</p>
                  </div>
                  <div className="rounded-2xl bg-white/12 p-4 backdrop-blur">
                    <p className="text-xs text-white/70">Face</p>
                    <p className="mt-1 text-2xl font-semibold">{students.filter((s) => s.face_enrolled).length}</p>
                  </div>
                  <div className="rounded-2xl bg-white/12 p-4 backdrop-blur">
                    <p className="text-xs text-white/70">Pending</p>
                    <p className="mt-1 text-2xl font-semibold">{students.filter((s) => !s.face_enrolled).length}</p>
                  </div>
                </div>

                <div className="mt-6 rounded-3xl bg-white/10 p-4 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Recent roster</p>
                    <Badge className="bg-white/15 text-white hover:bg-white/20">Live</Badge>
                  </div>
                  <div className="mt-4 space-y-3">
                    {students.slice(0, 4).map((student) => (
                      <div key={student.id} className="flex items-center justify-between rounded-2xl bg-white/10 px-3 py-2">
                        <div>
                          <p className="font-medium">{student.name}</p>
                          <p className="text-xs text-white/70">{student.roll_number || 'No roll number'}</p>
                        </div>
                        <Badge className={student.face_enrolled ? 'bg-emerald-500 text-white hover:bg-emerald-500' : 'bg-amber-400 text-slate-900 hover:bg-amber-400'}>
                          {student.face_enrolled ? 'Enrolled' : 'Pending'}
                        </Badge>
                      </div>
                    ))}
                    {students.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-white/20 p-4 text-sm text-white/70">
                        Your roster list will appear here once students are added.
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                    <div className="flex items-center gap-2 text-white/80">
                      <ShieldCheck className="size-4" />
                      <span>Face enrollment</span>
                    </div>
                    <p className="mt-2 text-xs text-white/70">Use the camera modal after saving the student record.</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                    <div className="flex items-center gap-2 text-white/80">
                      <Clock3 className="size-4" />
                      <span>Fast workflow</span>
                    </div>
                    <p className="mt-2 text-xs text-white/70">Add a roster first, then complete biometric enrollment.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Students Table */}
        <div className="glass-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/60 border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Roll Number</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Face Data</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {students.map((student) => (
                <tr key={student.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-6 py-4 text-foreground">{student.name}</td>
                  <td className="px-6 py-4 text-foreground">{student.roll_number || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      student.face_enrolled 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {student.face_enrolled ? 'Enrolled' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant={student.face_enrolled ? "outline" : "default"}
                        onClick={() => handleStartEnrollment(student.id, student.name)}
                        disabled={student.face_enrolled}
                      >
                        {student.face_enrolled ? 'Done' : 'Enroll Face'}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        disabled={saving}
                        onClick={() => deleteStudent(student.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {students.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">No students added yet</p>
            </div>
          )}
        </div>

      {/* Face Enrollment Modal */}
      {enrollingStudentId && (
        <FaceEnrollmentModal
          studentId={enrollingStudentId}
          studentName={enrollingStudentName}
          onEnrollmentComplete={handleEnrollmentComplete}
          onCancel={() => {
            setEnrollingStudentId(null)
            setEnrollingStudentName('')
          }}
        />
      )}
      </main>
    </DashboardShell>
  )
}
