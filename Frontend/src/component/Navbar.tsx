import React from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { RootState } from "../App/store";
import Logo from '../assets/logo.png'

interface NavbarProps {
  projectName?: string;
  onLogout?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ projectName, onLogout }) => {
  const { user } = useSelector((state: RootState) => state.auth);
  return (
    <nav className="navbar bg-slate-800 text-white px-4 py-2 flex justify-between items-center w-full">
      <div className="navbar-left flex items-center gap-4 pl-10 pt-0 mt-0">
        <Link to="/" className="text-xl font-bold">
          <img src={Logo} className="w-auto h-14" />
        </Link>
        {projectName && (
          <span className="text-lg font-semibold">Project: {projectName}</span>
        )}
      </div>
      <div className="navbar-right flex items-center gap-4">
        {user && (
          <div className="flex justify-end items-center  gap-2">
            <div className="w-8 h-8 rounded-full bg-pink-300 flex items-center justify-center">
              <span className="text-white font-semibold">
                {user.email[0].toUpperCase()}
              </span>
            </div>
            <span className="font-medium">{user.email}</span>
            {/* <img
                                    src={`https://ui-avatars.com/api/?name=${user.email.charAt(0).toUpperCase()}&background=random&color=fff`}
                                    alt={user.email}
                                    className="w-10 h-10 rounded-full mr-2"
                                />
                                <span className="text-slate-700">{user.email}</span> */}
          </div>
        )}

        {
          user && (

            <button
              onClick={onLogout}
              className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            >
              Logout
            </button>
          )
        }

      </div>
    </nav>
  );
};

export default Navbar;
