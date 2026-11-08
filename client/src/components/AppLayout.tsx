import type { ReactNode } from "react";

import Sidebar from "./Sidebar";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="app-layout">
      <Sidebar />

      <main className="app-layout-content">
        {children}
      </main>
    </div>
  );
}