import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "donor" | "seeker" | "admin";
}

export const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    // Redirect to login with return path
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && role !== requiredRole) {
    // Redirect to appropriate dashboard based on role
    if (role === "donor") {
      return <Navigate to="/donor-dashboard" replace />;
    }
    if (role === "seeker") {
      return <Navigate to="/seeker-dashboard" replace />;
    }
    if (role === "admin") {
      return <Navigate to="/admin" replace />;
    }
    // If no role matches, redirect to home
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

