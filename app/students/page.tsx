'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import FaceEnrollmentModal from '@/components/face-enrollment-modal'

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
  const supabase = createClient()

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
        
        if (error || !user) {
          if (error) console.error('Auth error:', error.message)
          await supabase.auth.signOut()
          router.push('/auth/login')
          return
        }
        setUser(user)
        setLoading(false)
      } catch (error) {
        console.error('Failed to get user:', error)
        await supabase.auth.signOut()
        router.push('/auth/login')
      }
    }

    getUser()
  }, [router, supabase.auth])

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

      const response = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStudent),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to add student')
      }

      setStudents((prev) => [payload.data, ...prev])
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

      const response = await fetch(`/api/students/${id}`, {
        method: 'DELETE',
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to delete student')
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

      const response = await fetch(`/api/students/${faceData.studentId}/face-enrollment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptor: faceData.descriptor }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to save face enrollment')
      }

      setStudents((prev) =>
        prev.map((student) =>
          student.id === faceData.studentId ? { ...student, face_enrolled: true } : student,
        ),
      )

      await fetchStudents()

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
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">Student Management</h1>
          <div className="flex gap-2">
            <Button onClick={() => setShowAddForm(!showAddForm)} className="gap-2">
              + Add Student
            </Button>
            <Link href="/">
              <Button variant="outline">Back</Button>
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded text-destructive">
            {error}
          </div>
        )}

        {/* Add Student Form */}
        {showAddForm && (
          <div className="mb-8 bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Add New Student</h2>
            <form onSubmit={handleAddStudent} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  placeholder="Full Name"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                  required
                />
                <Input
                  placeholder="Roll Number"
                  value={newStudent.roll_number}
                  onChange={(e) => setNewStudent({ ...newStudent, roll_number: e.target.value })}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>Add Student</Button>
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Students Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Roll Number</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Face Data</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {students.map((student) => (
                <tr key={student.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4 text-foreground">{student.name}</td>
                  <td className="px-6 py-4 text-foreground">{student.roll_number || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${
                      student.face_enrolled 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {student.face_enrolled ? '✓ Enrolled' : '⊗ Not Enrolled'}
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
                        {student.face_enrolled ? '✓ Enrolled' : 'Enroll Face'}
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

        {/* Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-muted-foreground text-sm mb-1">Total Students</p>
            <p className="text-3xl font-bold text-foreground">{students.length}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-muted-foreground text-sm mb-1">Face Enrolled</p>
            <p className="text-3xl font-bold text-foreground">{students.filter(s => s.face_enrolled).length}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-muted-foreground text-sm mb-1">Pending Enrollment</p>
            <p className="text-3xl font-bold text-foreground">{students.filter(s => !s.face_enrolled).length}</p>
          </div>
        </div>
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
  )
}
