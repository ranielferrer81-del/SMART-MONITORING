import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import StudentDashboard from './components/student_dashboard/StudentDashboard';
import TeacherDashboard from './components/teacher_dashboard/TeacherDashboard';
import StudentLivePresentation from './components/student_dashboard/StudentLivePresentation';
import AdminDashboard from './components/admin_dashboard/AdminDashboard';
import './App.css';

export function getAuthenticatedDashboardRoute() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const rawUser = localStorage.getItem('user');
    if (!rawUser) return '/teacher/dashboard';
    const user = JSON.parse(rawUser);
    const role = String(user?.role || '').toLowerCase();
    if (role === 'admin') return '/admin/dashboard';
    if (role === 'teacher' || role === 'professor') return '/teacher/dashboard';
    if (role === 'student') return '/student/dashboard';
    if (user?.course || user?.student_number) return '/student/dashboard';
    if (user?.department || user?.teacher_number) return '/teacher/dashboard';
    return '/admin/dashboard';
  } catch (_) {
    return null;
  }
}

function RequireAuth({ children }) {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function PublicOnlyRoute({ children }) {
  const dashboardRoute = getAuthenticatedDashboardRoute();
  if (dashboardRoute) {
    return <Navigate to={dashboardRoute} replace />;
  }
  return children;
}

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicOnlyRoute>
            <LoginForm />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/student/dashboard"
        element={
          <RequireAuth>
            <StudentDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/student/live-presentation"
        element={
          <RequireAuth>
            <StudentLivePresentation />
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
      <Route
        path="*"
        element={<Navigate to={getAuthenticatedDashboardRoute() || '/'} replace />}
      />
    </Routes>
  );
}

export default App;
