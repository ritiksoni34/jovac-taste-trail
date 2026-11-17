
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    ShoppingCart,
    UserCircle,
    CalendarDays,
    Package,
    LogOut,
    Menu,
    X
} from "lucide-react";

import { useAppContext } from "../context/AppContext";

const Navbar = () => {
    const navigate = useNavigate();
    const { user, setUser } = useAppContext();

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    const handleLogout = () => {
        setUser(null);
        setIsProfileOpen(false);
        setIsMenuOpen(false);
        navigate("/");
    };

    return (
        <nav className="site-navbar">
            <div className="navbar-container">

                {/* Logo */}
                <Link to="/" className="navbar-logo">
                    <span>Taste</span>Trail.
                </Link>

                {/* Desktop Navigation */}
                <div className="navbar-links">
                    <Link to="/">Home</Link>
                    <Link to="/menu">Menu</Link>
                    <Link to="/book-table">Book a Table</Link>
                    <Link to="/my-orders">My Orders</Link>
                </div>

                {/* Right Side */}
                <div className="navbar-actions">

                    <button
                        className="navbar-cart"
                        onClick={() => navigate("/cart")}
                        aria-label="Open cart"
                    >
                        <ShoppingCart size={21} />
                    </button>

                    {user ? (
                        <div className="profile-wrapper">
                            <button
                                className="profile-button"
                                onClick={() => setIsProfileOpen(!isProfileOpen)}
                            >
                                <UserCircle size={25} />
                            </button>

                            {isProfileOpen && (
                                <div className="profile-dropdown">
                                    <Link
                                        to="/my-orders"
                                        onClick={() => setIsProfileOpen(false)}
                                    >
                                        <Package size={17} />
                                        My Orders
                                    </Link>

                                    <Link
                                        to="/book-table"
                                        onClick={() => setIsProfileOpen(false)}
                                    >
                                        <CalendarDays size={17} />
                                        Book a Table
                                    </Link>

                                    <button onClick={handleLogout}>
                                        <LogOut size={17} />
                                        Logout
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button
                            className="navbar-login"
                            onClick={() => navigate("/login")}
                        >
                            Login
                        </button>
                    )}

                    {/* Mobile Menu Button */}
                    <button
                        className="mobile-menu-button"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        aria-label="Toggle navigation"
                    >
                        {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>

            {/* Mobile Navigation */}
            {isMenuOpen && (
                <div className="mobile-navigation">
                    <Link to="/" onClick={() => setIsMenuOpen(false)}>Home</Link>
                    <Link to="/menu" onClick={() => setIsMenuOpen(false)}>Menu</Link>
                    <Link to="/book-table" onClick={() => setIsMenuOpen(false)}>Book a Table</Link>
                    <Link to="/my-orders" onClick={() => setIsMenuOpen(false)}>My Orders</Link>

                    {!user && (
                        <Link to="/login" onClick={() => setIsMenuOpen(false)}>
                            Login
                        </Link>
                    )}

                    {user && (
                        <button onClick={handleLogout}>Logout</button>
                    )}
                </div>
            )}
        </nav>
    );
};

export default Navbar;
