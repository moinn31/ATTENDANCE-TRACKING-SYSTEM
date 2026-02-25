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
  email: string
  enrollment_number: string
  face_enrolled: boolean
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newStudent, setNewStudent] = useState({ name: '', email: '', enrollment_number: '' })
  const [enrollingStudentId, setEnrollingStudentId] = useState<string | null>(null)
  const [enrollingStudentName, setEnrollingStudentName] = useState<string>('')
  const router = useRouter()
  const supabase = createClient()

  // Check authentication
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }
      setUser(user)
      setLoading(false)
    }

    getUser()
  }, [router, supabase.auth])

  // Fetch students
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        // Mock data until database is set up
        const mockStudents: Student[] = [
          { id: '1', name: 'John Doe', email: 'john@example.com', enrollment_number: 'E001', face_enrolled: true },
          { id: '2', name: 'Jane Smith', email: 'jane@example.com', enrollment_number: 'E002', face_enrolled: true },
          { id: '3', name: 'Bob Johnson', email: 'bob@example.com', enrollment_number: 'E003', face_enrolled: false },
        ]
        setStudents(mockStudents)
      } catch (err) {
        console.error('[v0] Error fetching students:', err)
      }
    }

    if (!loading) {
      fetchStudents()
    }
  }, [loading])

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newStudent.name || !newStudent.email || !newStudent.enrollment_number) {
      alert('Please fill in all fields')
      return
    }

    try {
      // Add to mock data for now
      const student: Student = {
        id: Date.now().toString(),
        ...newStudent,
        face_enrolled: false,
      }
      setStudents([...students, student])
      setNewStudent({ name: '', email: '', enrollment_number: '' })
      setShowAddForm(false)
    } catch (err) {
      console.error('[v0] Error adding student:', err)
    }
  }

  const deleteStudent = (id: string) => {
    setStudents(students.filter(s => s.id !== id))
  }

  const handleStartEnrollment = (studentId: string, studentName: string) => {
    setEnrollingStudentId(studentId)
    setEnrollingStudentName(studentName)
  }

  const handleEnrollmentComplete = (faceData: any) => {
    console.log('[v0] Face enrollment data:', faceData)
    
    // Update student's face_enrolled status
    setStudents(
      students.map(s =>
        s.id === faceData.studentId ? { ...s, face_enrolled: true } : s
      )
    )
    
    setEnrollingStudentId(null)
    setEnrollingStudentName('')
    
    // Here you would normally save the face descriptor to your database
    // await supabase.from('face_embeddings').insert({...})
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
                  placeholder="Email"
                  type="email"
                  value={newStudent.email}
                  onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                  required
                />
                <Input
                  placeholder="Enrollment Number"
                  value={newStudent.enrollment_number}
                  onChange={(e) => setNewStudent({ ...newStudent, enrollment_number: e.target.value })}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Add Student</Button>
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
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Email</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Enrollment #</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Face Data</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {students.map((student) => (
                <tr key={student.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4 text-foreground">{student.name}</td>
                  <td className="px-6 py-4 text-foreground">{student.email}</td>
                  <td className="px-6 py-4 text-foreground">{student.enrollment_number}</td>
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
