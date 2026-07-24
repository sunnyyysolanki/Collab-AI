import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { Code2 } from "lucide-react";
import { RootState, AppDispatch } from "../App/store";
import { validateToken } from "../redux/auth.slice";

// Premium branded loading splash shown while the auth token is validated.
const LoadingScreen: React.FC = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#0b1120]">
    {/* Ambient gradient glows */}
    <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-indigo-600/30 blur-[120px]" />
    <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-blue-500/20 blur-[120px]" />

    <div className="relative flex flex-col items-center gap-8">
      {/* Logo with rotating gradient ring */}
      <div className="relative grid place-items-center">
        <div className="absolute h-24 w-24 animate-spin rounded-full border-2 border-transparent border-t-indigo-400 border-r-blue-400 [animation-duration:1.1s]" />
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-[0_10px_40px_-8px_rgba(79,70,229,0.6)]">
          <Code2 className="h-8 w-8 text-white" strokeWidth={2.5} />
        </div>
      </div>

      {/* Wordmark */}
      <div className="flex flex-col items-center gap-3">
        <span className="text-2xl font-bold tracking-tight text-white">
          Nex<span className="bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent">Code</span>
        </span>
        {/* Animated dots */}
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-300" />
        </div>
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-white/40">
          Loading workspace
        </span>
      </div>
    </div>
  </div>
);

const ProtectedRoute: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated, status, user } = useSelector(
    (state: RootState) => state.auth
  );
  const navigate = useNavigate();
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    } else if (!isAuthenticated && !user) {
      dispatch(validateToken());
      return;
    }
  }, [isAuthenticated, dispatch]);

  if (status === "loading") {
    return <LoadingScreen />;
  }

  if (!isAuthenticated && status === "failed") {
    return <Navigate to="/login" />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
