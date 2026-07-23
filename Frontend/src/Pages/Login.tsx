import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { LogIn, Mail, Lock } from 'lucide-react';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../App/store';
import { validateToken } from '../redux/auth.slice';
import { handleError, handleSuccess } from '../config/toastUtility';

interface User {
    id: string;
    email: string;
    name: string;
}

interface LocationState {
    redirectTo?: string;
}

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useDispatch<AppDispatch>();
    const state = location.state as LocationState;

    useEffect(() => {
        if (localStorage.getItem('token')) {
            // Check if there's a pending join token in session storage
            const pendingJoinToken = sessionStorage.getItem('pendingJoinToken');
            if (pendingJoinToken) {
                navigate(`/join/${pendingJoinToken}`);
                sessionStorage.removeItem('pendingJoinToken');
            } else {
                navigate('/home');
            }
        }
    }, [navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        try {
            const res = await axios.post<{ user: User; token: string }>(`${import.meta.env.VITE_API_URL}/users/login`, { email, password });
            const { token } = res.data;
            handleSuccess("Signup Successfull");

            localStorage.setItem('token', token);
            await dispatch(validateToken());

            // Check if there's a pending join token in session storage
            const pendingJoinToken = sessionStorage.getItem('pendingJoinToken');
            if (pendingJoinToken) {
                navigate(`/join/${pendingJoinToken}`);
                sessionStorage.removeItem('pendingJoinToken');
            } else if (state?.redirectTo) {
                navigate(state.redirectTo);
            } else {
                navigate('/home');
            }
        } catch (err: any) {
            console.error('Login Error:', err.response?.data || err.message);
            handleError(err.response?.data?.message || err.response.data.errors[0].msg);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
            <div className="max-w-md w-full space-y-8 bg-gray-800 p-8 rounded-xl shadow-2xl">
                <div className="text-center">
                    <div className="flex justify-center">
                        <LogIn className="h-12 w-12 text-indigo-500" />
                    </div>
                    <h2 className="mt-6 text-3xl font-bold text-white">Welcome back</h2>
                    <p className="mt-2 text-sm text-gray-400">Sign in to your account</p>

                    {state?.redirectTo?.includes('/join/') && (
                        <div className="mt-4 p-3 bg-indigo-900 rounded-md">
                            <p className="text-sm text-indigo-200">
                                Please log in to join the collaborative project
                            </p>
                        </div>
                    )}
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {error && (
                        <div className="p-3 bg-red-900 rounded-md text-red-200 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300" htmlFor="email">
                                Email address
                            </label>
                            <div className="mt-1 relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-gray-500" />
                                </div>
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-2 border border-gray-700 rounded-md bg-gray-900 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    placeholder="you@example.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300" htmlFor="password">
                                Password
                            </label>
                            <div className="mt-1 relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-500" />
                                </div>
                                <input
                                    id="password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-2 border border-gray-700 rounded-md bg-gray-900 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <input
                                id="remember-me"
                                name="remember-me"
                                type="checkbox"
                                className="h-4 w-4 text-indigo-500 focus:ring-indigo-500 border-gray-700 rounded bg-gray-900"
                            />
                            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-300">
                                Remember me
                            </label>
                        </div>

                        <div className="text-sm">
                            <a href="#" className="font-medium text-indigo-500 hover:text-indigo-400">
                                Forgot password?
                            </a>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-gray-900"
                    >
                        Sign in
                    </button>

                    <p className="text-center text-sm text-gray-400">
                        Don't have an account?{' '}
                        <Link to="/signup" className="font-medium text-indigo-500 hover:text-indigo-400">
                            Sign up
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    );
};

export default Login;