import { useEffect, useRef, useState } from "react";
import { GoogleMap, LoadScript } from "@react-google-maps/api";

const containerStyle = {
  width: "100%",
  height: "100%",
};

export default function MapView() {
  const [position, setPosition] = useState({ lat: 0, lng: 0 });
  const [heading, setHeading] = useState(0);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    let watchId: number;

    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, heading } = pos.coords;

          const newPos = {
            lat: latitude,
            lng: longitude,
          };

          setPosition(newPos);
          setHeading(heading ?? 0);

          // Create or update the custom marker
          if (
            mapRef.current &&
            (window as any).google?.maps?.marker?.AdvancedMarkerElement
          ) {
            const markerEl = document.createElement("div");
            markerEl.className = "custom-marker";
            markerEl.style.transform = `rotate(${heading ?? 0}deg)`;

            if (!markerRef.current) {
              markerRef.current = new (
                window as any
              ).google.maps.marker.AdvancedMarkerElement({
                map: mapRef.current,
                position: newPos,
                content: markerEl,
                title: "You are here",
              });
            } else {
              markerRef.current.position = newPos;
              markerRef.current.content = markerEl;
            }
          }
        },
        (err) => {
          console.error("Geolocation error:", err);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    }

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  return (
    <LoadScript
      googleMapsApiKey={(import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY}
      libraries={["marker"]}
    >
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={position}
        zoom={14}
        options={{
          mapId: "7a88b640cdf282b0d2a0f6f4",
          tilt: 45, // tilt in degrees (0 disables)
          heading: 90, // rotation in degrees (0 is default north)
          rotateControl: true,
        }}
      />
    </LoadScript>
  );
}
