
import { Link, Outlet } from "react-router-dom";

function AdminLayout() {
    return (
        <div className="admin-layout">
            <aside className="admin-sidebar">
                <h2>Admin Panel</h2>

                <Link to="/admin/add-category">Add Category</Link>
                <Link to="/admin/categories">Categories</Link>
                <Link to="/admin/add-menu">Add Menu</Link>
                <Link to="/admin/menus">Show Menus</Link>
                <Link to="/admin/orders">Orders</Link>
            </aside>

            <main className="admin-content">
                <Outlet />
            </main>
        </div>
    );
}

export default AdminLayout;
