import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import { useDispatch } from 'react-redux';
import { logout } from '../redux/auth.slice';



const Layout: React.FC = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const handleLogout = () => {
        // Clear user authentication data (e.g., remove token from localStorage)
        localStorage.removeItem('authToken');
        dispatch(logout());
        // Redirect to login page
        navigate('/login');
    };

    return (
        <div className="layout flex flex-col h-screen">
            <Navbar onLogout={handleLogout} />
            <div className="content">
                <Outlet />
            </div>
        </div>
    );
};

export default Layout;