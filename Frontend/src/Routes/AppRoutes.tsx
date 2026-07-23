import { Route, BrowserRouter, Routes } from 'react-router-dom'
import Login from '../Pages/Login'
import Signup from '../Pages/Signup'
import Home from '../Pages/Home'
import Project from '../Pages/Project'
import UserAuth from '../auth/UserAuth'
import Layout from '../component/Layout'
import ProjectDashboard from '../Pages/dashboard'
import JoinProject from '../component/JoinProject'


const AppRoutes = () => {
    return (
        <>
            <BrowserRouter>
                <Routes>
                    <Route element={<Layout />}>
                        <Route path="/login" element={<Login />} />
                        <Route path="/signup" element={<Signup />} />
                        <Route path="/" element={<Login />} />
                    </Route>

                    <Route path="/join/:token" element={<JoinProject />} />
                    <Route element={<UserAuth />}>
                        <Route element={<Layout />}>
                            <Route path="/home" element={<Home />} />
                            <Route path="/project/:id" element={<Project />} />
                            <Route path="/dashboard" element={<ProjectDashboard />} />
                        </Route>
                    </Route>
                </Routes>
            </BrowserRouter>
        </>
    )
}

export default AppRoutes