import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Header from './components/Layout/Header';
import Footer from './components/Layout/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import About from './pages/About';
import Login from './pages/Login';
import Browse from './pages/Browse';
import PaperDetails from './pages/PaperDetails';
import BlogDetails from './pages/BlogDetails';
import Profile from './pages/Profile';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/Admin';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="flex flex-col min-h-screen">
          <Header />
          <main className="flex-1">
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
                  <ProtectedRoute roles={['author', 'admin']}>
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
            </Routes>
          </main>
          <Footer />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
