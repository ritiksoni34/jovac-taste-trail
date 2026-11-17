
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const { setUser } = useAppContext();
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();

        setUser({ email });
        alert("Login successful!");
        navigate("/");
    };

    return (
        <div className="auth-page">
            <form className="auth-form" onSubmit={handleSubmit}>
                <h2>Welcome Back</h2>

                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />

                <button type="submit">Login</button>

                <p>
                    New user? <Link to="/signup">Create Account</Link>
                </p>
            </form>
        </div>
    );
}

export default Login;
