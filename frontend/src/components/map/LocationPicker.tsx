import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, Polyline, TileLayer, useMapEvents } from 'react-leaflet'
import { CITY_CENTRE, QUADRANT_LINES } from '../../data/calgary'
import type { CategoryId } from '../../types'
import { eventMarkerIcon } from './markers'

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) })
  return null
}

/** Click/tap to drop a pin. Keyboard users can choose from the venue list instead (always offered). */
export default function LocationPicker({
  lat,
  lng,
  categoryId,
  onPick,
}: {
  lat: number | null
  lng: number | null
  categoryId: CategoryId | ''
  onPick: (lat: number, lng: number) => void
}) {
  const has = lat !== null && lng !== null
  return (
    <div className="h-72 overflow-hidden rounded-card border border-line-strong">
      <MapContainer center={has ? [lat!, lng!] : [CITY_CENTRE.lat, CITY_CENTRE.lng]} zoom={has ? 14 : 11} className="map-muted h-full w-full cursor-crosshair">
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
        {QUADRANT_LINES.map((line, i) => (
          <Polyline key={i} positions={line} interactive={false} pathOptions={{ color: '#202124', weight: 2, opacity: 0.45, dashArray: '6 8' }} />
        ))}
        <ClickToPlace onPick={onPick} />
        {has && <Marker position={[lat!, lng!]} icon={eventMarkerIcon(categoryId || 'meetups', true)} keyboard={false} />}
      </MapContainer>
    </div>
  )
}
