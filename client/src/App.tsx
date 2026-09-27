import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import { SocketProvider } from './contexts/SocketContext';
import { AppShell } from './components/layout/AppShell';
import LoginPage from './pages/LoginPage';
import PipelinePage from './pages/PipelinePage';
import ClientsPage from './pages/ClientsPage';
import ClientPortalPage from './pages/ClientPortalPage';
import DashboardPage from './pages/DashboardPage';
import EmailTemplatesPage from './pages/EmailTemplatesPage';
import TasksPage from './pages/TasksPage';
import AutomationPage from './pages/AutomationPage';
import NotFoundPage from './pages/NotFoundPage';
import DocumentsPage from './pages/DocumentsPage';
import PlaceholderPage from './pages/PlaceholderPage';
import { ErrorBoundary } from './components/ErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Route guard — redirect to /login if unauthenticated */
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { user, isAuthenticated } = useAuth();

  // If user is logged in as a client, route them directly to the Client Portal
  if (isAuthenticated && user?.role === 'client') {
    return (
      <Routes>
        <Route path="/portal" element={<ClientPortalPage />} />
        <Route path="*"       element={<Navigate to="/portal" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <PrivateRoute>
            <AppShell />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/pipeline" replace />} />
        <Route path="/pipeline"    element={<PipelinePage />} />
        <Route path="/dashboard"   element={<DashboardPage />} />
        <Route path="/clients"     element={<ClientsPage />} />
        <Route path="/tasks"       element={<TasksPage />} />
        <Route path="/templates"   element={<EmailTemplatesPage />} />
        <Route path="/automation"  element={<AutomationPage />} />
        <Route path="/users"       element={<PlaceholderPage title="Team" />} />
        <Route path="/documents"   element={<DocumentsPage />} />
        <Route path="*"            element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <SocketProvider>
            <BrowserRouter>
              <ErrorBoundary>
                <AppRoutes />
              </ErrorBoundary>
            </BrowserRouter>
          </SocketProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
