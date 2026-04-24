"use client";

import { useEffect, useState } from "react";
import { ChatWindow } from "@/components/ChatWindow";
import { VendorSwitcher, type Vendor } from "@/components/VendorSwitcher";

export default function Home() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/vendors")
      .then((r) => r.json())
      .then((data) => {
        if (data.vendors?.length) {
          setVendors(data.vendors);
          setSelected(data.vendors[0].id);
        } else if (data.error) {
          setLoadError(data.error);
        }
      })
      .catch((err) => setLoadError(String(err)));
  }, []);

  const selectedVendor = vendors.find((v) => v.id === selected);

  return (
    <main className="min-h-screen bg-bg-app">
      {/* Top bar — Deep Teal per the style guide */}
      <header className="bg-brand-primary text-white">
        <div className="max-w-[1400px] mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-brand bg-white/15 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M2 11L5 5L8 9L12 3"
                  stroke="#39FF14"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <div className="text-[15px] font-bold tracking-[-0.02em] leading-tight">
                NexTrade
              </div>
              <div
                className="text-[10px] uppercase tracking-[0.14em] opacity-70 leading-tight"
                style={{ fontFamily: "ui-monospace, monospace" }}
              >
                Vendor Portal · AI Reporting
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-[12px] opacity-80">
              <span className="ai-dot" />
              AI Assistant live
            </div>
          </div>
        </div>
      </header>

      {/* Content grid */}
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        {loadError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-brand text-small text-red-700">
            Failed to load vendors: {loadError}. Did you run{" "}
            <code className="font-mono">npm run db:push &amp;&amp; npm run db:seed</code>?
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
          {/* Sidebar */}
          <aside className="space-y-5">
            <VendorSwitcher
              vendors={vendors}
              selectedId={selected}
              onChange={setSelected}
            />

            <div className="bg-bg-surface border border-border-hairline rounded-brand p-4">
              <div className="label-mono mb-2">Data isolation</div>
              <p className="text-small text-text-muted leading-relaxed">
                Switch vendors above — the assistant will only ever return
                data for the active company. The filter is enforced
                server-side in parameterized SQL, not by the model.
              </p>
            </div>

            <div className="bg-bg-surface border border-border-hairline rounded-brand p-4">
              <div className="label-mono mb-2">What I can answer</div>
              <ul className="text-small text-text-primary leading-relaxed space-y-1.5">
                <li>• Top / bottom products, revenue by category</li>
                <li>• Trends over time (day · week · month)</li>
                <li>• Compare days or weekdays</li>
                <li>• Order cancellations and reasons</li>
              </ul>
            </div>
          </aside>

          {/* Chat — fills the main region as required by the style guide */}
          <section className="h-[calc(100vh-170px)] min-h-[560px]">
            <ChatWindow
              vendorId={selected}
              vendorName={selectedVendor?.company_name ?? "there"}
            />
          </section>
        </div>
      </div>
    </main>
  );
}
