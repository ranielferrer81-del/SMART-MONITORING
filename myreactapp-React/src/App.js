import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import StudentDashboard from './components/student_dashboard/StudentDashboard';
import TeacherDashboard from './components/teacher_dashboard/TeacherDashboard';
import AdminDashboard from './components/admin_dashboard/AdminDashboard';
import './App.css';

function RequireAuth({ children }) {
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem('user'));
  } catch (_) {}
  if (!user) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginForm />} />
      <Route
        path="/student/dashboard"
        element={
          <RequireAuth>
            <StudentDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/teacher/dashboard"
        element={
          <RequireAuth>
            <TeacherDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/dashboard"
        element={
          <RequireAuth>
            <AdminDashboard />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
