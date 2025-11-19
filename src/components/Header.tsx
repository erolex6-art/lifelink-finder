import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Droplets, LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Header = () => {
  const location = useLocation();
  const { user, profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  
  // Hide header on login and register pages (they have their own headers)
  // Index page handles its own header with auth check
  if (location.pathname === "/login" || location.pathname === "/register" || (location.pathname === "/" && !user)) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Determine where the logo should navigate based on role
  const getHomeLink = () => {
    if (!user) return "/";
    if (role === "donor") return "/donor-dashboard";
    if (role === "seeker") return "/seeker-dashboard";
    if (role === "admin") return "/admin";
    return "/";
  };

  return (
    <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <nav className="flex items-center justify-between">
          <Link to={getHomeLink()} className="flex items-center gap-2">
            <Droplets className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">LifeLink</span>
          </Link>

          <div className="flex items-center gap-4">
            {user && profile ? (
              <>
                {/* Role-specific navigation */}
                {role === "donor" && (
                  <Link to="/donor-dashboard">
                    <Button variant="ghost">Browse Requests</Button>
                  </Link>
                )}
                {role === "seeker" && (
                  <Link to="/seeker-dashboard">
                    <Button variant="ghost">My Requests</Button>
                  </Link>
                )}

                {/* User menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {getInitials(profile.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden sm:inline">{profile.full_name}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate("/profile")}>
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost">Login</Button>
                </Link>
                <Link to="/register">
                  <Button>Register</Button>
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
};

