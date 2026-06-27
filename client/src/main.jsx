import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import CheckoutPage from "./pages/CheckoutPage";

const params = new URLSearchParams(window.location.search);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {params.get("_ptxn")
      ? <CheckoutPage />
      : <App />}
  </React.StrictMode>
);