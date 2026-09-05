"use client";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { useSyncExternalStore } from "react";
const subscribe = () => () => {};
export function SettingsPanel() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <section className="card">
      <div className="section-heading">
        <h2>Make yourself at home</h2>
      </div>
      <p className="muted fine-print" style={{ marginTop: 10 }}>
        Choose how CalTrack looks on this device.
      </p>
      <div className="theme-choices">
        {[
          { id: "light", name: "Light", icon: Sun },
          { id: "dark", name: "Dark", icon: Moon },
          { id: "system", name: "System", icon: Monitor },
        ].map(({ id, name, icon: Icon }) => (
          <button
            className={`choice ${mounted && theme === id ? "selected" : ""}`}
            aria-pressed={mounted && theme === id}
            key={id}
            onClick={() => setTheme(id)}
          >
            <Icon size={18} />
            <strong>{name}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}
