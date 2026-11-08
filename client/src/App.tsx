
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { AuthProvider } from "./context/AuthProvider";

import Protected from "./components/Protected";
import Navbar from "./components/Navbar";
import AppLayout from "./components/AppLayout";

import Register from "./pages/Register";
import Security from "./pages/Security";
import VerifyEmail from "./pages/VerifyEmail";
import Login from "./pages/Login";

import "./App.css";

export default function App() {
  return (
  <BrowserRouter>
    <AuthProvider>
      <div className="site-container">
        <Navbar />

        <div className="site-content">
          <Routes>
            <Route
              path="/"
              element={<Navigate to="/register" replace />}
            />

            <Route
              path="/register"
              element={<Register />}
            />

            <Route
              path="/verify-email"
              element={<VerifyEmail />}
            />

            <Route
              path="/login"
              element={<Login />}
            />

            <Route
              path="/security"
              element={
                <Protected>
                  <AppLayout>
                    <Security />
                  </AppLayout>
                </Protected>
              }
            />

            <Route
              path="*"
              element={<Navigate to="/register" replace />}
            />
          </Routes>
        </div>
      </div>
    </AuthProvider>
  </BrowserRouter>
);
}
