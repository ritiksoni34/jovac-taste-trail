import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AppProvider } from "./context/AppContext.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
    <BrowserRouter>
        <AppProvider>
            <App />
        </AppProvider>
    </BrowserRouter>
);