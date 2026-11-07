import 'leaflet/dist/leaflet.css'
import { Circle, MapContainer, Marker, TileLayer } from 'react-leaflet'
import type { CalgaryEvent } from '../../types'
import { eventMarkerIcon } from './markers'

/** Small location map for an event page. Approximate locations show an area circle, never a pin. */
export default function MiniMap({ event }: { event: CalgaryEvent }) {
  const center: [number, number] = [event.venue.lat, event.venue.lng]
  return (
    <figure className="h-56 overflow-hidden rounded-card border border-line">
      <figcaption className="sr-only">{`Map showing ${event.venue.approximate ? 'the approximate area' : 'the location'}: ${event.venue.name}, ${event.venue.quadrant} Calgary`}</figcaption>
      <MapContainer center={center} zoom={event.venue.approximate ? 14 : 15} scrollWheelZoom={false} className="map-muted h-full w-full" keyboard={false}>
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
        {event.venue.approximate ? (
          <Circle center={center} radius={450} pathOptions={{ color: '#C8102E', weight: 2, dashArray: '6 6', fillOpacity: 0.12 }} />
        ) : (
          <Marker position={center} icon={eventMarkerIcon(event.categoryId, true)} keyboard={false} interactive={false} />
        )}
      </MapContainer>
    </figure>
  )
}
