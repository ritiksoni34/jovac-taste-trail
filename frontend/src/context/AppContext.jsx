
import { createContext, useContext, useState } from "react";

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
    const [categories, setCategories] = useState(
        JSON.parse(localStorage.getItem("categories") || "[]")
    );

    const [menus, setMenus] = useState(
        JSON.parse(localStorage.getItem("menus") || "[]")
    );

    const [user, setUser] = useState(null);

    const addCategory = (category) => {
        const updated = [...categories, {
            id: Date.now(),
            name: category
        }];
        setCategories(updated);
        localStorage.setItem("categories", JSON.stringify(updated));
    };

    const deleteCategory = (id) => {
        const updated = categories.filter(item => item.id !== id);
        setCategories(updated);
        localStorage.setItem("categories", JSON.stringify(updated));
    };

    const addMenu = (menu) => {
        const updated = [...menus, {
            id: Date.now(),
            ...menu
        }];
        setMenus(updated);
        localStorage.setItem("menus", JSON.stringify(updated));
    };

    const deleteMenu = (id) => {
        const updated = menus.filter(item => item.id !== id);
        setMenus(updated);
        localStorage.setItem("menus", JSON.stringify(updated));
    };

    return (
        <AppContext.Provider value={{
            categories,
            menus,
            user,
            setUser,
            addCategory,
            deleteCategory,
            addMenu,
            deleteMenu
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => useContext(AppContext);
