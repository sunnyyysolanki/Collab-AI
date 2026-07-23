import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { RootState, AppDispatch } from "../App/store";
import { validateToken } from "../redux/auth.slice";

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
    return <div>Loading...</div>;
  }

  if (!isAuthenticated && status === "failed") {
    return <Navigate to="/login" />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
