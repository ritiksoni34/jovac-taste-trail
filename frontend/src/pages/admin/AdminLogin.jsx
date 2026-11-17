
import { useState } from "react";
import { useNavigate } from "react-router-dom";

function AdminLogin() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();

        if (email && password) {
            navigate("/admin/add-category");
        }
    };

    return (
        <div className="auth-page">
            <form className="auth-form" onSubmit={handleSubmit}>
                <h2>Admin Login</h2>

                <input type="email" placeholder="Admin Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)} required />

                <input type="password" placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)} required />

                <button type="submit">Login as Admin</button>
            </form>
        </div>
    );
}

export default AdminLogin;
