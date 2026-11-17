
function AdminOrders() {
    const orders = [];

    return (
        <div className="admin-page">
            <h2>Customer Orders</h2>

            {orders.length === 0 ? (
                <p>No orders available right now.</p>
            ) : (
                orders.map((order) => (
                    <div key={order.id} className="order-card">
                        <h3>Order #{order.id}</h3>
                        <p>Status: {order.status}</p>
                        <p>Total: ₹{order.total}</p>
                    </div>
                ))
            )}
        </div>
    );
}

export default AdminOrders;
