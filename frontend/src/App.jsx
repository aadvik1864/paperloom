import { lazy, Suspense, useLayoutEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ErrorBoundary from './components/Common/ErrorBoundary';
import Header from './components/Layout/Header';
import Footer from './components/Layout/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import About from './pages/About';
import Login from './pages/Login';
import Browse from './pages/Browse';
import NotFound from './pages/NotFound';
import { LoadingPage } from './components/Common/Loading';

const PaperDetails = lazy(() => import('./pages/PaperDetails'));
const BlogDetails = lazy(() => import('./pages/BlogDetails'));
const Profile = lazy(() => import('./pages/Profile'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AdminDashboard = lazy(() => import('./pages/Admin'));

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <ThemeProvider>
        <AuthProvider>
          <ErrorBoundary>
            <div className="flex flex-col min-h-screen">
              <Header />
              <main id="main-content" className="flex-1" tabIndex={-1}>
                <Suspense fallback={<LoadingPage />}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/browse" element={<Browse />} />
                  <Route path="/papers/:id" element={<PaperDetails />} />
                  <Route path="/blogs/:slug" element={<BlogDetails />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/profile/:id" element={<Profile />} />
                  <Route
                    path="/dashboard/*"
                    element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/*"
                    element={
                      <ProtectedRoute roles={['admin']}>
                        <AdminDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                </Suspense>
              </main>
              <Footer />
            </div>
          </ErrorBoundary>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

export default App;
