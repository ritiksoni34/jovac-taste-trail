import { useContext, useState } from "react";
import { AppContext } from "../context/AppContext";
import { Link } from "react-router-dom";
import {ShoppingCart, UserCircle,CalendarDays, Package, LogOut} from "lucide-react";

const 
Navbar = () => {
    const {navigate,user,setUser} = useContext(AppContext);
    const [isMenuOpen,setIsMenuOpen]=useState(false);
    const [isProfileOpen,setIsProfileOpen]=useState(false);
  return ( 
  <nav className="bg-cyan-50 shadow-md sticky top-0 z-50 py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
                {/* left - logo k liye */}
                <div className="flex items-center ">
                    <Link to="/" className="text-2xl font-bold text-blue-600">
                    <img src="./logo.png" alt="" className="w-32" />
                    </Link>
                </div>
                {/* centre -Menu k liye h */}
                <div className="hidden md:flex items-center space-x-8">
                    <Link to={'/'} className="text-grey-700 hover:text-blue-600 transmition-colors font-medium">Home</Link>
                    <Link to={'/Menu'} className="text-grey-700 hover:text-blue-600 transmition-colors font-medium">Menu</Link>
                    <Link to={'/Contact'} className="text-grey-700 hover:text-blue-600 transmition-colors font-medium">Contact</Link>
                </div>
                {/* right - cart & button k liye*/}
                <div className="flex items-center space-x-4">
                    <button onClick={()=> navigate("/Cart")} className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <ShoppingCart size={22} className="text-grey-700"/>
                        <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-x rounded-full w-5 h-5 felx items-center justify-center font-medium">3</span>
                    </button>
                    <div className="hidden md:block">
                        {
                            user?(
                                <div className="relative">
                                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colours"
                                    onMouseEnter={()=> setIsProfileOpen(true)}
                                    onMouseLeave={()=> setIsProfileOpen(false)}
                                    >
                                    <UserCircle size={30} className="text-grey-700"/>
                                    </button>

                                    {isProfileOpen&&(
                                        <div
                                    onMouseEnter={()=> setIsProfileOpen(true)}
                                    onMouseLeave={()=> setIsProfileOpen(false)}
                                    className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg p-2 border border-gray-100"
                                        >
                                            <Link to={"/Mybookings"} className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 transitions-colors">
                                            <CalendarDays size={18} className="mr-3"/>
                                            My Bookings
                                            </Link>
                                            <Link to={"/MyOrders"} className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 transitions-colors">
                                            <Package size={18} className="mr-3"/>
                                            My Orders
                                            </Link>
                                            <button onClick={() => {
                                                    setUser(false);
                                                    setIsProfileOpen(false);
                                                }}
                                                className="flex items-center w-full px-4 py-2 text-red-600 hover:bg-red-50"
                                            >
                                                <LogOut size={18} className="mr-3" />
                                                Logout
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ):(
                                <button onClick={() => navigate("/Login")}
                                className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition-colors font-medium cursor-pointer"
                                >Login</button>
                            )
                        }
                    </div>
                </div>
            </div>

            {isMenuOpen&&(
                <div className="md:hidden py-4 border-t border-gray-200">
                    <div className="felx flex-col space-3"></div>
                         <Link to={'/'} className="text-grey-700 hover:text-blue-600 transmition-colors font-medium">Home</Link>
                        <Link to={'/Menu'} className="text-grey-700 hover:text-blue-600 transmition-colors font-medium">Menu</Link>
                        <Link to={'/Contact'} className="text-grey-700 hover:text-blue-600 transmition-colors font-medium">Contact</Link>

                        {
                            user?(
                                <div className="relative">
                                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colours"
                                    onMouseEnter={()=> setIsProfileOpen(true)}
                                    onMouseLeave={()=> setIsProfileOpen(false)}
                                    >
                                    <UserCircle size={30} className="text-grey-700"/>
                                    </button>

                                    {isProfileOpen&&(
                                        <div
                                    onMouseEnter={()=> setIsProfileOpen(true)}
                                    onMouseLeave={()=> setIsProfileOpen(false)}
                                    className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg p-2 border border-gray-100"
                                        >
                                            <Link to={"/Mybookings"} className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 transitions-colors">
                                            <CalendarDays size={18} className="mr-3"/>
                                            My Bookings
                                            </Link>
                                            <Link to={"/MyOrders"} className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 transitions-colors">
                                            <Package size={18} className="mr-3"/>
                                            My Orders
                                            </Link>
                                            <button onClick={() => {
                                                        setUser(false);
                                                        setIsProfileOpen(false);
                                                    }}
                                                    className="flex items-center w-full px-4 py-2 text-red-600 hover:bg-red-50"
                                                >
                                                    <LogOut size={18} className="mr-3" />
                                                    Logout
                                                </button>
                                        </div>
                                    )}
                                </div>
                            ):(
                                <button onClick={() => navigate("/Login")}
                                className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition-colors font-medium cursor-pointer"
                                >Login</button>
                            )
                        }
                </div>
            )
            }
        </div>
    </nav>
    );
};

export default Navbar;