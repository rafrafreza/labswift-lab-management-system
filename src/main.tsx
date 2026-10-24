import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { SpeedInsights } from "@vercel/speed-insights/react" 

import App from "@/App";
import { AuthProvider } from "@/contexts/AuthContext";
import "@/styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: { fontFamily: "var(--font-sans)", fontSize: "13px" },
        }}
      />
      <SpeedInsights />
    </AuthProvider>
  </BrowserRouter>,
);
