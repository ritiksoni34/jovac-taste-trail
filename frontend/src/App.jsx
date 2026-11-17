
import { Routes, Route, Link } from "react-router-dom";
import { useState } from "react";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import { useAppContext } from "./context/AppContext";
import "./index.css";

// HOME PAGE
function Home() {
    return (
        <div className="home">
            <section className="hero">
                <div>
                    <p className="tagline">WELCOME TO TASTETRAIL</p>
                    <h1>Good Food.<br />Good Mood.</h1>
                    <p>Discover delicious food and order your favourites.</p>
                    <Link to="/menu" className="primary-btn">Explore Menu</Link>
                </div>
                <div className="hero-emoji">🍔</div>
            </section>

            <h2>Explore Categories</h2>
            <div className="food-grid">
                {["🍕 Pizza", "🍔 Burgers", "🍜 Noodles", "🍰 Desserts"].map(item => (
                    <div className="food-card" key={item}>
                        <h3>{item}</h3>
                    </div>
                ))}
            </div>
        </div>
    );
}

// MENU PAGE
function Menu() {
    const { menus, categories } = useAppContext();
    const [filter, setFilter] = useState("All");
    const [search, setSearch] = useState("");

    const filtered = menus.filter(item => {
        const categoryMatch =
            filter === "All" || item.category === filter;

        const searchMatch =
            (item.name || "").toLowerCase().includes(search.toLowerCase());

        return categoryMatch && searchMatch;
    });

    const addToCart = (item) => {
        const cart = JSON.parse(localStorage.getItem("cart") || "[]");

        const existing = cart.find(cartItem => cartItem.id === item.id);

        let updated;

        if (existing) {
            updated = cart.map(cartItem =>
                cartItem.id === item.id
                    ? { ...cartItem, quantity: (cartItem.quantity || 1) + 1 }
                    : cartItem
            );
        } else {
            updated = [...cart, { ...item, quantity: 1 }];
        }

        localStorage.setItem("cart", JSON.stringify(updated));
        alert(item.name + " added to cart!");
    };

    return (
        <div className="page">
            <div className="menu-top">
                <div>
                    <p className="tagline">FRESHLY MADE FOR YOU</p>
                    <h1>Explore Our Menu</h1>
                </div>

                <input
                    className="menu-search"
                    type="text"
                    placeholder="Search food..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            <div className="filters">
                {["All", ...categories.map(c => c.name)].map(category => (
                    <button
                        key={category}
                        className={filter === category ? "active" : ""}
                        onClick={() => setFilter(category)}
                    >
                        {category}
                    </button>
                ))}
            </div>

            <div className="food-grid">
                {filtered.length > 0 ? (
                    filtered.map(item => (
                        <div className="food-card" key={item.id}>
                            <div className="food-image">🍽️</div>
                            <h3>{item.name}</h3>
                            <p>{item.description || "Freshly prepared and delicious."}</p>
                            <div className="food-price">₹{item.price}</div>

                            <button
                                className="add-cart-btn"
                                onClick={() => addToCart(item)}
                            >
                                + Add to Cart
                            </button>
                        </div>
                    ))
                ) : (
                    <div className="empty-state">
                        <h3>No food items found</h3>
                        <p>Add food items from Admin or try another search.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// CART PAGE
function Cart() {
    const [cart, setCart] = useState(
        JSON.parse(localStorage.getItem("cart") || "[]")
    );

    const updateCart = (updated) => {
        setCart(updated);
        localStorage.setItem("cart", JSON.stringify(updated));
    };

    const removeItem = (id) => {
        updateCart(cart.filter(item => item.id !== id));
    };

    const changeQuantity = (id, amount) => {
        const updated = cart
            .map(item =>
                item.id === id
                    ? { ...item, quantity: (item.quantity || 1) + amount }
                    : item
            )
            .filter(item => item.quantity > 0);

        updateCart(updated);
    };

    const total = cart.reduce(
        (sum, item) => sum + Number(item.price || 0) * (item.quantity || 1),
        0
    );

    return (
        <div className="page">
            <h1>My Cart</h1>

            {cart.length > 0 ? (
                <>
                    {cart.map(item => (
                        <div className="cart-item" key={item.id}>
                            <div>
                                <h3>{item.name}</h3>
                                <p>₹{item.price} each</p>
                            </div>

                            <div>
                                <button onClick={() => changeQuantity(item.id, -1)}>-</button>
                                <span style={{ margin: "0 12px" }}>
                                    {item.quantity || 1}
                                </span>
                                <button onClick={() => changeQuantity(item.id, 1)}>+</button>
                            </div>

                            <strong>
                                ₹{Number(item.price) * (item.quantity || 1)}
                            </strong>

                            <button onClick={() => removeItem(item.id)}>
                                Remove
                            </button>
                        </div>
                    ))}

                    <h2>Total: ₹{total}</h2>
                    <Link to="/checkout" className="primary-btn">Proceed to Checkout</Link>
                </>
            ) : (
                <div className="empty-state">
                    <h3>Your cart is empty</h3>
                    <p>Add something delicious from our menu.</p>
                    <Link to="/menu" className="primary-btn">Explore Menu</Link>
                </div>
            )}
        </div>
    );
}

// CHECKOUT PAGE
function Checkout() {
    const [form, setForm] = useState({
        name: "",
        phone: "",
        address: ""
    });

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const cart = JSON.parse(localStorage.getItem("cart") || "[]");

        if (cart.length === 0) {
            alert("Your cart is empty!");
            return;
        }

        const orders = JSON.parse(localStorage.getItem("orders") || "[]");

        const newOrder = {
            id: Date.now(),
            customer: form,
            items: cart,
            total: cart.reduce(
                (sum, item) => sum + Number(item.price) * (item.quantity || 1),
                0
            ),
            date: new Date().toLocaleString(),
            status: "Placed"
        };

        localStorage.setItem("orders", JSON.stringify([...orders, newOrder]));
        localStorage.removeItem("cart");

        alert("Order placed successfully!");
        window.location.href = "/my-orders";
    };

    return (
        <div className="page form-page">
            <h1>Checkout</h1>
            <form onSubmit={handleSubmit}>
                <input
                    name="name"
                    placeholder="Full Name"
                    value={form.name}
                    onChange={handleChange}
                    required
                />
                <input
                    name="phone"
                    type="tel"
                    placeholder="Phone Number"
                    value={form.phone}
                    onChange={handleChange}
                    required
                />
                <textarea
                    name="address"
                    placeholder="Delivery Address"
                    value={form.address}
                    onChange={handleChange}
                    required
                />
                <button className="primary-btn">Place Order</button>
            </form>
        </div>
    );
}

// TABLE BOOKING
function Booking() {
    return (
        <div className="page form-page">
            <h1>Book a Table</h1>
            <form onSubmit={e => {
                e.preventDefault();
                alert("Table booking request submitted!");
            }}>
                <input placeholder="Your Name" required />
                <input type="tel" placeholder="Phone Number" required />
                <input type="date" required />
                <input type="time" required />
                <input type="number" placeholder="Number of Guests" min="1" required />
                <button className="primary-btn">Book Now</button>
            </form>
        </div>
    );
}

// MY ORDERS
function MyOrders() {
    const orders = JSON.parse(localStorage.getItem("orders") || "[]");

    return (
        <div className="page">
            <h1>My Orders</h1>

            {orders.length > 0 ? orders.map(order => (
                <div className="food-card" key={order.id}>
                    <h3>Order #{order.id}</h3>
                    <p>Date: {order.date}</p>
                    <p>Status: {order.status}</p>
                    <p>Items: {order.items.map(item => item.name).join(", ")}</p>
                    <h3>Total: ₹{order.total}</h3>
                </div>
            )) : (
                <p>No orders found.</p>
            )}
        </div>
    );
}

// ADMIN DASHBOARD
function AdminDashboard() {
    const { categories, menus } = useAppContext();
    const orders = JSON.parse(localStorage.getItem("orders") || "[]");

    return (
        <div className="page">
            <h1>Admin Dashboard</h1>

            <div className="food-grid">
                <div className="food-card">
                    <h3>Categories</h3>
                    <h2>{categories.length}</h2>
                </div>
                <div className="food-card">
                    <h3>Menu Items</h3>
                    <h2>{menus.length}</h2>
                </div>
                <div className="food-card">
                    <h3>Orders</h3>
                    <h2>{orders.length}</h2>
                </div>
            </div>

            <div className="admin-links">
                <Link to="/admin/categories">Categories</Link>
                <Link to="/admin/add-category">Add Category</Link>
                <Link to="/admin/add-menu">Add Menu</Link>
                <Link to="/admin/menus">Manage Menus</Link>
                <Link to="/admin/orders">Orders</Link>
            </div>
        </div>
    );
}

// ADD CATEGORY
function AddCategory() {
    const { addCategory } = useAppContext();
    const [name, setName] = useState("");

    return (
        <div className="page form-page">
            <h1>Add Category</h1>
            <form onSubmit={e => {
                e.preventDefault();
                addCategory(name.trim());
                setName("");
                alert("Category added!");
            }}>
                <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Category Name"
                    required
                />
                <button className="primary-btn">Add Category</button>
            </form>
        </div>
    );
}

// VIEW CATEGORIES
function Categories() {
    const { categories, deleteCategory } = useAppContext();

    return (
        <div className="page">
            <h1>Categories</h1>

            {categories.length > 0 ? categories.map(category => (
                <div className="cart-item" key={category.id}>
                    <span>{category.name}</span>
                    <button onClick={() => deleteCategory(category.id)}>Delete</button>
                </div>
            )) : <p>No categories added yet.</p>}
        </div>
    );
}

// ADD MENU ITEM
function AddMenu() {
    const { addMenu, categories } = useAppContext();

    const [form, setForm] = useState({
        name: "",
        description: "",
        price: "",
        category: ""
    });

    const change = e => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    return (
        <div className="page form-page">
            <h1>Add Food Item</h1>

            <form onSubmit={e => {
                e.preventDefault();

                if (categories.length === 0) {
                    alert("Please add a category first.");
                    return;
                }

                addMenu(form);
                alert("Menu item added!");

                setForm({
                    name: "",
                    description: "",
                    price: "",
                    category: ""
                });
            }}>
                <input
                    name="name"
                    value={form.name}
                    onChange={change}
                    placeholder="Food Name"
                    required
                />

                <input
                    name="description"
                    value={form.description}
                    onChange={change}
                    placeholder="Description"
                />

                <input
                    name="price"
                    type="number"
                    min="1"
                    value={form.price}
                    onChange={change}
                    placeholder="Price"
                    required
                />

                <select
                    name="category"
                    value={form.category}
                    onChange={change}
                    required
                >
                    <option value="">Select Category</option>
                    {categories.map(category => (
                        <option key={category.id} value={category.name}>
                            {category.name}
                        </option>
                    ))}
                </select>

                <button className="primary-btn">Add Food</button>
            </form>
        </div>
    );
}

// MANAGE MENU
function AdminMenus() {
    const { menus, deleteMenu } = useAppContext();

    return (
        <div className="page">
            <h1>Manage Menu</h1>

            {menus.length > 0 ? menus.map(item => (
                <div className="cart-item" key={item.id}>
                    <span>{item.name} — ₹{item.price} ({item.category})</span>
                    <button onClick={() => deleteMenu(item.id)}>Delete</button>
                </div>
            )) : <p>No menu items available.</p>}
        </div>
    );
}

// MANAGE ORDERS
function AdminOrders() {
    const orders = JSON.parse(localStorage.getItem("orders") || "[]");

    return (
        <div className="page">
            <h1>Manage Orders</h1>

            {orders.length > 0 ? orders.map(order => (
                <div className="food-card" key={order.id}>
                    <h3>Order #{order.id}</h3>
                    <p>Customer: {order.customer.name}</p>
                    <p>Phone: {order.customer.phone}</p>
                    <p>Address: {order.customer.address}</p>
                    <p>Items: {order.items.map(item => item.name).join(", ")}</p>
                    <h3>Total: ₹{order.total}</h3>
                    <p>Status: {order.status}</p>
                </div>
            )) : <p>No orders available.</p>}
        </div>
    );
}

// MAIN APP
export default function App() {
    return (
        <>
            <Navbar />

            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/menu" element={<Menu />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/book-table" element={<Booking />} />
                <Route path="/my-orders" element={<MyOrders />} />

                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />

                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/add-category" element={<AddCategory />} />
                <Route path="/admin/categories" element={<Categories />} />
                <Route path="/admin/add-menu" element={<AddMenu />} />
                <Route path="/admin/menus" element={<AdminMenus />} />
                <Route path="/admin/orders" element={<AdminOrders />} />
            </Routes>
        </>
    );
}
