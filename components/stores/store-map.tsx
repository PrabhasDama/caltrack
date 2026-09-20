"use client";
import { useEffect, useRef, useState } from "react";
type Point = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
};
let loader: Promise<void> | undefined;
function load(key: string) {
  if (!loader)
    loader = new Promise((resolve, reject) => {
      if (typeof window.google !== "undefined" && window.google.maps) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&libraries=maps,marker&v=weekly&callback=caltrackMapReady`;
      Object.assign(window, { caltrackMapReady: resolve });
      script.onerror = () => {
        loader = undefined;
        reject(Error("Map unavailable"));
      };
      document.head.appendChild(script);
      setTimeout(() => {
        if (!window.google?.maps?.importLibrary) {
          loader = undefined;
          reject(Error("Map timed out"));
        }
      }, 15000);
    });
  return loader;
}
export function StoreMap({
  apiKey,
  mapId,
  points,
  active,
  onSelect,
}: {
  apiKey: string;
  mapId: string;
  points: Point[];
  active: string;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    map = useRef<google.maps.Map | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!apiKey) return;
    let gone = false;
    const markers: google.maps.marker.AdvancedMarkerElement[] = [];
    load(apiKey)
      .then(async () => {
        const { Map } = (await google.maps.importLibrary(
          "maps",
        )) as google.maps.MapsLibrary;
        const { AdvancedMarkerElement } = (await google.maps.importLibrary(
          "marker",
        )) as google.maps.MarkerLibrary;
        if (gone || !ref.current) return;
        const valid = points.filter(
          (p) => p.latitude !== null && p.longitude !== null,
        );
        if (!valid.length) return;
        if (!map.current)
          map.current = new Map(ref.current, {
            center: { lat: valid[0].latitude!, lng: valid[0].longitude! },
            zoom: 12,
            mapId,
            gestureHandling: "cooperative",
          });
        const bounds = new google.maps.LatLngBounds();
        for (const p of valid) {
          const position = { lat: p.latitude!, lng: p.longitude! };
          bounds.extend(position);
          const button = document.createElement("button");
          button.className = `store-marker${p.id === active ? " selected" : ""}`;
          button.textContent = p.id === active ? "●" : "○";
          button.setAttribute("aria-label", p.name);
          button.onclick = () => onSelect(p.id);
          markers.push(
            new AdvancedMarkerElement({
              map: map.current,
              position,
              title: p.name,
              content: button,
            }),
          );
        }
        const selected = valid.find((p) => p.id === active);
        if (selected)
          map.current.panTo({
            lat: selected.latitude!,
            lng: selected.longitude!,
          });
        else map.current.fitBounds(bounds);
      })
      .catch(() => {
        if (!gone)
          setError(
            "The map could not load. Your store list is still available.",
          );
      });
    return () => {
      gone = true;
      for (const m of markers) m.map = null;
    };
  }, [apiKey, mapId, points, active, onSelect]);
  if (!apiKey)
    return (
      <p className="notice">
        Map display is not configured. Search and select real stores in the
        list. A restricted Google Maps key enables the interactive map.
      </p>
    );
  return (
    <>
      {error && <p role="status">{error}</p>}
      <div ref={ref} className="store-map" aria-label="Nearby store map" />
    </>
  );
}
