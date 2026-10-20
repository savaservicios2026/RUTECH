import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

interface PinPickerProps {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}

const pinIcon = L.divIcon({
  className: '',
  html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#e11d48;border:3px solid #fff;transform:rotate(-45deg);box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 22],
});

/** Small map to put the customer's point exactly: drag the pin or tap where it goes. */
export const PinPicker: React.FC<PinPickerProps> = ({ lat, lng, onChange }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!boxRef.current) return;
    const map = L.map(boxRef.current, { zoomControl: true }).setView([lat, lng], 17);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    const marker = L.marker([lat, lng], { draggable: true, icon: pinIcon }).addTo(map);
    marker.on('dragend', () => {
      const p = marker.getLatLng();
      onChangeRef.current(p.lat, p.lng);
    });
    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      onChangeRef.current(e.latlng.lat, e.latlng.lng);
    });
    mapRef.current = map;
    markerRef.current = marker;
    setTimeout(() => map.invalidateSize(), 100);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Follow the point when it changes from outside (e.g. after searching the address)
  useEffect(() => {
    const marker = markerRef.current;
    const map = mapRef.current;
    if (!marker || !map) return;
    const cur = marker.getLatLng();
    if (Math.abs(cur.lat - lat) > 1e-7 || Math.abs(cur.lng - lng) > 1e-7) {
      marker.setLatLng([lat, lng]);
      map.setView([lat, lng], Math.max(map.getZoom(), 16));
    }
  }, [lat, lng]);

  return <div ref={boxRef} className="w-full h-56 rounded-lg border border-slate-300 overflow-hidden isolate" />;
};
