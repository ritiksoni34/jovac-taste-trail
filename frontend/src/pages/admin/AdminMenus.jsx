
import { useAppContext } from "../../context/AppContext";

function AdminMenus() {
    const { menus, deleteMenu } = useAppContext();

    return (
        <div className="admin-page">
            <h2>All Menu Items</h2>

            <div className="menu-grid">
                {menus.length === 0 ? (
                    <p>No menu items available.</p>
                ) : (
                    menus.map((item) => (
                        <div className="menu-card" key={item.id}>
                            <h3>{item.name}</h3>
                            <p>{item.description}</p>
                            <p>Category: {item.category}</p>
                            <h4>₹{item.price}</h4>

                            <button onClick={() => deleteMenu(item.id)}>
                                Delete
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default AdminMenus;
