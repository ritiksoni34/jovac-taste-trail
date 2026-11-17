
import { useState } from "react";
import { useAppContext } from "../../context/AppContext";

function AddMenu() {
    const { categories, addMenu } = useAppContext();

    const [menu, setMenu] = useState({
        name: "",
        description: "",
        price: "",
        category: ""
    });

    const handleChange = (e) => {
        setMenu({ ...menu, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        addMenu(menu);

        setMenu({
            name: "",
            description: "",
            price: "",
            category: ""
        });

        alert("Menu Added Successfully!");
    };

    return (
        <div className="admin-page">
            <h2>Add Menu Item</h2>

            <form onSubmit={handleSubmit}>
                <input
                    name="name"
                    placeholder="Menu Name"
                    value={menu.name}
                    onChange={handleChange}
                    required
                />

                <textarea
                    name="description"
                    placeholder="Description"
                    value={menu.description}
                    onChange={handleChange}
                    required
                />

                <input
                    name="price"
                    type="number"
                    placeholder="Price"
                    value={menu.price}
                    onChange={handleChange}
                    required
                />

                <select
                    name="category"
                    value={menu.category}
                    onChange={handleChange}
                    required
                >
                    <option value="">Select Category</option>

                    {categories.map((item) => (
                        <option key={item.id} value={item.name}>
                            {item.name}
                        </option>
                    ))}
                </select>

                <button type="submit">Add Menu</button>
            </form>
        </div>
    );
}

export default AddMenu;
