
import { useState } from "react";
import { useAppContext } from "../../context/AppContext";

function AddCategory() {
    const [category, setCategory] = useState("");
    const { addCategory } = useAppContext();

    const handleSubmit = (e) => {
        e.preventDefault();

        if (category.trim()) {
            addCategory(category.trim());
            setCategory("");
            alert("Category Added Successfully!");
        }
    };

    return (
        <div className="admin-page">
            <h2>Add Category</h2>

            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    placeholder="Enter Category Name"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                />

                <button type="submit">Add Category</button>
            </form>
        </div>
    );
}

export default AddCategory;
