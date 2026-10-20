import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

const REFERENCE_TOWNS: [string, number, number][] = [
  ['A Coruña', 43.362, -8.411], ['Ferrol', 43.484, -8.233], ['Cedeira', 43.660, -8.054],
  ['Betanzos', 43.280, -8.211], ['Ares', 43.426, -8.243], ['Santiago', 42.878, -8.544],
  ['Negreira', 42.909, -8.736], ['Ribeira', 42.556, -8.992], ['Pontevedra', 42.431, -8.644],
  ['Vigo', 42.240, -8.720], ['Ourense', 42.336, -7.864], ['Lugo', 43.012, -7.556],
  ['Viveiro', 43.662, -7.594], ['Monforte', 42.521, -7.514], ['Ponferrada', 42.546, -6.598],
  ['León', 42.599, -5.567], ['Oviedo', 43.361, -5.849], ['Gijón', 43.532, -5.661],
];
import { Technician, ServiceJob, TechnicianRouteSummary } from '../types';
import { MapPin, Navigation, Eye, User, Clock, AlertCircle } from 'lucide-react';

interface MapViewProps {
  technicians: Technician[];
  services: ServiceJob[];
  summaries: Map<string, TechnicianRouteSummary>;
  selectedTechnicianId: string | 'all';
  setSelectedTechnicianId: (id: string | 'all') => void;
  onSelectService: (service: ServiceJob) => void;
}

export const MapView: React.FC<MapViewProps> = ({
  technicians,
  services,
  summaries,
  selectedTechnicianId,
  setSelectedTechnicianId,
  onSelectService,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Default center around Galicia, Asturias and León
      const map = L.map(mapContainerRef.current, {
        center: [42.8782, -8.5448],
        zoom: 8,
        zoomControl: true,
      });

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).once('tileerror', () => {
        // Map tiles can't load inside Claude: show reference towns over a plain grid instead
        mapContainerRef.current?.classList.add('rt-offline-map');
        REFERENCE_TOWNS.forEach(([name, lat, lng]) => {
          L.marker([lat, lng], {
            interactive: false,
            keyboard: false,
            icon: L.divIcon({ className: 'rt-town', html: `<span>${name}</span>`, iconSize: [0, 0] }),
          }).addTo(map);
        });
      }).addTo(map);

      layerGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      // Cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers & Polylines whenever data or selected tech changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layers = layerGroupRef.current;
    if (!map || !layers) return;

    layers.clearLayers();

    const bounds = L.latLngBounds([]);
    let hasPoints = false;

    // Filter which technicians to render
    const techsToRender = selectedTechnicianId === 'all'
      ? technicians.filter(t => t.availability.isAvailableToday)
      : technicians.filter(t => t.id === selectedTechnicianId);

    // 1. Render Technician Bases & Routes
    techsToRender.forEach(tech => {
      const summary = summaries.get(tech.id);
      const stops = summary ? summary.stops : [];
      const routePoints: L.LatLngExpression[] = [];

      // Base Marker
      const baseLat = tech.baseLocation.lat;
      const baseLng = tech.baseLocation.lng;
      routePoints.push([baseLat, baseLng]);
      bounds.extend([baseLat, baseLng]);
      hasPoints = true;

      const baseIconHtml = `
        <div style="background-color: ${tech.color};" class="w-8 h-8 rounded-xl shadow-lg border-2 border-white flex items-center justify-center text-white transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-110">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
      `;

      const baseMarker = L.marker([baseLat, baseLng], {
        icon: L.divIcon({
          html: baseIconHtml,
          className: 'custom-base-icon',
          iconSize: [32, 32],
        }),
      });

      baseMarker.bindPopup(`
        <div class="p-2 font-sans text-xs">
          <div class="font-bold text-sm text-slate-800 flex items-center gap-1.5 mb-1">
            <span style="background-color: ${tech.color};" class="w-2.5 h-2.5 rounded-full inline-block"></span>
            ${tech.name} (Base)
          </div>
          <div class="text-slate-500 mb-1">${tech.baseLocation.address}</div>
          <div class="text-blue-600 font-medium">Horario: ${tech.schedule.start} - ${tech.schedule.end}</div>
        </div>
      `);

      layers.addLayer(baseMarker);

      // Render Service Stops of this tech
      const techJobs = services
        .filter(s => s.assignedTechnicianId === tech.id)
        .sort((a, b) => a.manualOrder - b.manualOrder);

      techJobs.forEach((job, index) => {
        const stopLat = job.location.lat;
        const stopLng = job.location.lng;
        routePoints.push([stopLat, stopLng]);
        bounds.extend([stopLat, stopLng]);

        const isUrgent = job.priority === 'urgente';
        const hasConflict = !!job.conflict;

        const stopIconHtml = `
          <div style="background-color: ${tech.color};" class="relative w-7 h-7 rounded-full shadow-md border-2 border-white flex items-center justify-center text-white font-bold text-xs transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-125 ${
            isUrgent ? 'ring-2 ring-rose-500 ring-offset-1 animate-bounce' : ''
          } ${hasConflict ? 'ring-2 ring-amber-400 ring-offset-1' : ''}">
            <span>${index + 1}</span>
            ${
              hasConflict
                ? `<span class="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 text-[9px] rounded-full flex items-center justify-center text-white border border-white">!</span>`
                : ''
            }
          </div>
        `;

        const stopMarker = L.marker([stopLat, stopLng], {
          icon: L.divIcon({
            html: stopIconHtml,
            className: 'custom-stop-icon',
            iconSize: [28, 28],
          }),
        });

        stopMarker.bindPopup(`
          <div class="p-2.5 font-sans text-xs max-w-xs">
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <span class="px-2 py-0.5 rounded font-bold text-white text-[11px]" style="background-color: ${tech.color};">
                Parada #${index + 1}
              </span>
              <span class="text-slate-400 font-mono text-[11px]">${job.code}</span>
            </div>
            <div class="font-bold text-slate-800 text-sm mb-1">${job.customerName}</div>
            <div class="text-slate-600 mb-1 text-[11px]">${job.title}</div>
            <div class="text-slate-500 mb-2 flex items-start gap-1">
              <span>📍</span> <span>${job.location.address}</span>
            </div>
            
            <div class="bg-slate-50 p-2 rounded border border-slate-200 mb-2 space-y-1">
              <div class="flex justify-between text-slate-700">
                <span>Llegada estimada:</span>
                <strong class="text-blue-600">${job.scheduledArrival || '--:--'}</strong>
              </div>
              <div class="flex justify-between text-slate-600">
                <span>Franja cliente:</span>
                <span>${job.timeSlot.label}</span>
              </div>
              <div class="flex justify-between text-slate-600">
                <span>Duración:</span>
                <span>${job.estimatedDuration} min</span>
              </div>
            </div>

            ${
              job.conflict
                ? `<div class="p-1.5 mb-2 bg-rose-50 text-rose-700 rounded text-[11px] border border-rose-200">
                    ⚠️ ${job.conflict.message}
                   </div>`
                : ''
            }

            <div class="text-right">
              <button 
                id="popup-btn-${job.id}"
                class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium cursor-pointer transition-colors"
              >
                Gestionar servicio
              </button>
            </div>
          </div>
        `);

        stopMarker.on('popupopen', () => {
          const btn = document.getElementById(`popup-btn-${job.id}`);
          if (btn) {
            btn.onclick = () => onSelectService(job);
          }
        });

        layers.addLayer(stopMarker);
      });

      // Render polyline route connecting Base -> Stops
      if (routePoints.length > 1) {
        const polyline = L.polyline(routePoints, {
          color: tech.color,
          weight: 4,
          opacity: 0.85,
          dashArray: '8, 8',
          lineCap: 'round',
        });
        layers.addLayer(polyline);
      }
    });

    // 2. Render Unassigned Services in Gray/Amber
    const unassignedJobs = services.filter(s => !s.assignedTechnicianId);
    unassignedJobs.forEach(job => {
      const stopLat = job.location.lat;
      const stopLng = job.location.lng;
      bounds.extend([stopLat, stopLng]);
      hasPoints = true;

      const unassignedHtml = `
        <div class="w-7 h-7 rounded-full bg-slate-700 border-2 border-dashed border-amber-400 flex items-center justify-center text-amber-300 font-bold text-xs shadow-md transform -translate-x-1/2 -translate-y-1/2 cursor-pointer animate-pulse hover:scale-125">
          <span>?</span>
        </div>
      `;

      const marker = L.marker([stopLat, stopLng], {
        icon: L.divIcon({
          html: unassignedHtml,
          className: 'custom-unassigned-icon',
          iconSize: [28, 28],
        }),
      });

      marker.bindPopup(`
        <div class="p-2.5 font-sans text-xs max-w-xs">
          <div class="flex items-center justify-between gap-2 mb-1.5">
            <span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 font-bold text-[11px] border border-amber-400">
              Sin Asignar
            </span>
            <span class="text-slate-400 font-mono text-[11px]">${job.code}</span>
          </div>
          <div class="font-bold text-slate-800 text-sm mb-1">${job.customerName}</div>
          <div class="text-slate-600 mb-1 text-[11px]">${job.title}</div>
          <div class="text-slate-500 mb-2">📍 ${job.location.address}</div>
          
          <div class="bg-amber-50 p-2 rounded border border-amber-200 mb-2 text-amber-800 text-[11px]">
            ${job.conflict?.message || 'Pendiente de asignar a un técnico disponible.'}
          </div>

          <div class="text-right">
            <button 
              id="popup-unassigned-${job.id}"
              class="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-medium cursor-pointer"
            >
              Asignar Técnico
            </button>
          </div>
        </div>
      `);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`popup-unassigned-${job.id}`);
        if (btn) {
          btn.onclick = () => onSelectService(job);
        }
      });

      layers.addLayer(marker);
    });

    // Auto-fit map to points
    if (hasPoints && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }
  }, [technicians, services, summaries, selectedTechnicianId, onSelectService]);

  return (
    <div className="relative isolate w-full h-full min-h-[520px] bg-slate-100 flex flex-col">
      {/* Top Filter Bar over Map */}
      <div className="absolute top-4 left-4 z-[400] bg-white/95 backdrop-blur-sm p-2 rounded-xl shadow-lg border border-slate-200 flex items-center gap-2 max-w-md overflow-x-auto text-xs">
        <span className="text-slate-500 font-medium pl-1 flex items-center gap-1">
          <Eye className="w-3.5 h-3.5 text-blue-600" />
          Ruta:
        </span>

        <button
          onClick={() => setSelectedTechnicianId('all')}
          className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
            selectedTechnicianId === 'all'
              ? 'bg-slate-900 text-white shadow'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Todos ({technicians.filter(t => t.availability.isAvailableToday).length})
        </button>

        {technicians
          .filter(t => t.availability.isAvailableToday)
          .map(tech => (
            <button
              key={tech.id}
              onClick={() => setSelectedTechnicianId(tech.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                selectedTechnicianId === tech.id
                  ? 'text-white shadow'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              style={{
                backgroundColor: selectedTechnicianId === tech.id ? tech.color : undefined,
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: selectedTechnicianId === tech.id ? '#ffffff' : tech.color }}
              />
              <span>{tech.name.split(' ')[0]}</span>
            </button>
          ))}
      </div>

      {/* Legend overlay */}
      <div className="absolute bottom-4 left-4 z-[400] bg-white/90 backdrop-blur-sm px-3 py-2 rounded-xl shadow-md border border-slate-200 text-[11px] text-slate-700 hidden sm:flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded bg-blue-600 flex items-center justify-center text-white text-[9px] font-bold">
            🏠
          </div>
          <span>Base de Salida</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
            1
          </div>
          <span>Orden de Parada</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-full bg-slate-700 border border-dashed border-amber-400 flex items-center justify-center text-amber-300 text-[9px] font-bold">
            ?
          </div>
          <span>Sin Asignar</span>
        </div>
      </div>

      {/* Leaflet Map DOM Container */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[520px] rounded-b-xl z-0" />
    </div>
  );
};
