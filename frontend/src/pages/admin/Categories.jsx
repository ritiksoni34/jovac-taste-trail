
import { useAppContext } from "../../context/AppContext";

function Categories() {
    const { categories, deleteCategory } = useAppContext();

    return (
        <div className="admin-page">
            <h2>All Categories</h2>

            {categories.length === 0 ? (
                <p>No categories added yet.</p>
            ) : (
                <div className="category-list">
                    {categories.map((item) => (
                        <div className="category-card" key={item.id}>
                            <h3>{item.name}</h3>

                            <button onClick={() => deleteCategory(item.id)}>
                                Delete
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default Categories;
