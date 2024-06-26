let map;
let userLocationMarker;
let destinationMarker; // Variable to store the destination marker

const bangaloreCoordinates = [77.5946, 12.9716]; // Coordinates for Bangalore

// Initialize the map
function initializeMap(center = bangaloreCoordinates) {
    map = new mapboxgl.Map({
        container: 'map', // container ID
        center: center, // starting position [lng, lat]
        zoom: 17, // starting zoom
        pitch: 60, // starting pitch
    });

    // Add the geocoder control to the map and position it
    const geocoder = new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        mapboxgl: mapboxgl
    });
    map.addControl(geocoder, 'top-left');

    geocoder.on('result', (e) => {
        const destinationCoords = e.result.geometry.coordinates;
        fetchDirections(userLocationMarker.getLngLat().toArray(), destinationCoords);

        // Remove previous destination marker if exists
        if (destinationMarker) {
            destinationMarker.remove();
        }

        // Add marker for destination
        destinationMarker = new mapboxgl.Marker({ color: 'red' })
            .setLngLat(destinationCoords)
            .setPopup(new mapboxgl.Popup().setHTML("<h4>Destination</h4>"))
            .addTo(map);
    });

    // Add fullscreen control and position it
    map.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    // Add geolocate control and position it
    const geolocate = new mapboxgl.GeolocateControl({
        positionOptions: {
            enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserHeading: true
    });

    map.addControl(geolocate, 'top-right');

    geolocate.on('geolocate', (e) => {
        const userLocation = [e.coords.longitude, e.coords.latitude];

        if (!userLocationMarker) {
            // Add marker for user's location
            userLocationMarker = new mapboxgl.Marker()
                .setLngLat(userLocation)
                .setPopup(new mapboxgl.Popup().setHTML("<h4>You are here</h4>"))
                .addTo(map);
        } else {
            // Update the marker's location
            userLocationMarker.setLngLat(userLocation);
            map.panTo(userLocation);
        }
    });

    // Add custom control for panning to the full route
    map.addControl(new PanToRouteControl(), 'top-right');

    // Add custom controls for pitch, bearing, and zoom
    const pitchControl = new PitchControl();
    const bearingControl = new BearingControl();
    const zoomControls = new ZoomControls();

    map.addControl(pitchControl, 'top-left');
    map.addControl(bearingControl, 'top-left');
    map.addControl(zoomControls, 'top-left');
}

// Custom Control for panning to the full route
class PanToRouteControl {
    onAdd(map) {
        this.map = map;
        this.container = document.createElement('div');
        this.container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
        this.button = document.createElement('button');
        this.button.className = 'mapboxgl-ctrl-icon';
        this.button.type = 'button';
        this.button.title = 'Show entire route';
        this.button.innerHTML = '⤢'; // Unicode character for an outward arrow
        this.button.onclick = () => {
            const routeSource = this.map.getSource('route');
            if (routeSource) {
                const routeData = routeSource._data;
                fitRouteToBounds(routeData);
            }
        };
        this.container.appendChild(this.button);
        return this.container;
    }

    onRemove() {
        this.container.parentNode.removeChild(this.container);
        this.map = undefined;
    }
}


// Watch the user's location and update the map
navigator.geolocation.watchPosition(position => {
    const userLocation = [position.coords.longitude, position.coords.latitude];

    if (!userLocationMarker) {
        initializeMap(userLocation);

        // Add marker for user's location
        userLocationMarker = new mapboxgl.Marker()
            .setLngLat(userLocation)
            .setPopup(new mapboxgl.Popup().setHTML("<h4>You are here</h4>"))
            .addTo(map);
    } else {
        // Update the marker's location
        userLocationMarker.setLngLat(userLocation);
        map.panTo(userLocation);
    }
}, error => {
    console.error("Error getting user location:", error);
}, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 27000
});

// Fetch directions from the Flask API
function fetchDirections(start, end) {
    fetch(`/directions?start=${start.join(',')}&end=${end.join(',')}`)
        .then(response => response.json())
        .then(data => {
            const route = data.route;
            addRouteToMap(route);
            fitRouteToBounds(route);
        });
}

// Add the route to the map
function addRouteToMap(route) {
    if (map.getSource('route')) {
        map.getSource('route').setData(route);
    } else {
        map.addLayer({
            id: 'route',
            type: 'line',
            source: {
                type: 'geojson',
                data: route
            },
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#3887be',
                'line-width': 10,
                'line-opacity': 0.75
            }
        });
    }
}

// Fit the map to the bounds of the route
function fitRouteToBounds(route) {
    const bounds = new mapboxgl.LngLatBounds();
    route.coordinates.forEach(coord => {
        bounds.extend(coord);
    });
    map.fitBounds(bounds, {
        padding: { top: 20, bottom: 20, left: 20, right: 20 },
        pitch: 0
    });
}
