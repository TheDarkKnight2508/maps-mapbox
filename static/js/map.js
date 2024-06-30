let map;
let userLocationMarker;
let startMarker;
let endMarker;
let startCoordinates;
let endCoordinates;

const bangaloreCoordinates = [77.5946, 12.9716];

// Initialize the map
function initializeMap(center = bangaloreCoordinates) {
    map = new mapboxgl.Map({
        container: 'map',
        center: center,
        zoom: 17,
        pitch: 60,
    });

    map.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    const geolocate = new mapboxgl.GeolocateControl({
        positionOptions: {
            enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserHeading: true
    });

    map.addControl(geolocate, 'top-right');

    map.addControl(new PanToRouteControl(), 'top-right');
    map.addControl(new PitchControl(), 'top-left');
    map.addControl(new BearingControl(), 'top-left');
    map.addControl(new ZoomControls(), 'top-left');

    geolocate.on('geolocate', (e) => {
        const userLocation = [e.coords.longitude, e.coords.latitude];
        if (userLocationMarker) {
            userLocationMarker.setLngLat(userLocation);
        } else {
            userLocationMarker = new mapboxgl.Marker({
                color: 'blue',
                draggable: false
            }).setLngLat(userLocation).addTo(map);
        }
    });
}

// Initialize the geocoders
function initializeGeocoders() {
    const geocoderStart = new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        mapboxgl: mapboxgl,
        placeholder: "Enter starting location"
    });

    const geocoderEnd = new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        mapboxgl: mapboxgl,
        placeholder: "Enter destination"
    });

    document.getElementById('geocoder-start').appendChild(geocoderStart.onAdd(map));
    document.getElementById('geocoder-end').appendChild(geocoderEnd.onAdd(map));

    geocoderStart.on('result', (e) => {
        startCoordinates = e.result.geometry.coordinates;
        addStartMarker(startCoordinates);
        panToLocation(startCoordinates);
    });

    geocoderEnd.on('result', (e) => {
        endCoordinates = e.result.geometry.coordinates;
        addEndMarker(endCoordinates);
        panToLocation(endCoordinates);
    });
}

// Add start marker
function addStartMarker(coordinates) {
    if (startMarker) {
        startMarker.setLngLat(coordinates);
    } else {
        startMarker = new mapboxgl.Marker({ color: 'blue' })
            .setLngLat(coordinates)
            .setPopup(new mapboxgl.Popup().setHTML("<h4>Start Location</h4>"))
            .addTo(map);
    }
}

// Add end marker
function addEndMarker(coordinates) {
    if (endMarker) {
        endMarker.setLngLat(coordinates);
    } else {
        endMarker = new mapboxgl.Marker({ color: 'red' })
            .setLngLat(coordinates)
            .setPopup(new mapboxgl.Popup().setHTML("<h4>End Location</h4>"))
            .addTo(map);
    }
}

// Pan to location
function panToLocation(coordinates) {
    map.flyTo({
        center: coordinates,
        essential: true,
        zoom: 17
    });
}

// Use user location as starting location
function useUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            startCoordinates = [position.coords.longitude, position.coords.latitude];
            panToLocation(startCoordinates);
            clearGeocoderInput('geocoder-start');
            setGeocoderInput('geocoder-start', startCoordinates);
        }, error => {
            console.error("Error getting user location:", error);
            alert("Unable to retrieve your location. Please try again.");
        });
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}

// Clear geocoder input
function clearGeocoderInput(geocoderId) {
    const geocoderInput = document.querySelector(`#${geocoderId} .mapboxgl-ctrl-geocoder--input`);
    if (geocoderInput) {
        geocoderInput.value = '';
    }
}

// Set geocoder input
function setGeocoderInput(geocoderId, coordinates) {
    const geocoderInput = document.querySelector(`#${geocoderId} .mapboxgl-ctrl-geocoder--input`);
    if (geocoderInput) {
        geocoderInput.value = `${coordinates[1]}, ${coordinates[0]}`;
    }
}

class PanToRouteControl {
    onAdd(map) {
        this.map = map;
        this.container = document.createElement('div');
        this.container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
        this.button = document.createElement('button');
        this.button.className = 'mapboxgl-ctrl-icon';
        this.button.type = 'button';
        this.button.title = 'Show entire route';
        this.button.innerHTML = '⤢';
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

// Initialize map with user's current location or default location
navigator.geolocation.getCurrentPosition(position => {
    const userLocation = [position.coords.longitude, position.coords.latitude];
    initializeMap(userLocation);
}, error => {
    console.error("Error getting user location:", error);
    initializeMap();
}, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 27000
});

// Load geocoders independently on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeGeocoders();
});

function getRoute() {
    if (!startCoordinates || !endCoordinates) {
        alert("Please enter both a starting location and a destination.");
        return;
    }

    fetch(`/directions?start=${startCoordinates.join(',')}&end=${endCoordinates.join(',')}`)
        .then(response => response.json())
        .then(data => {
            const route = data.route;
            addRouteToMap(route);
            fitRouteToBounds(route);
        })
        .catch(error => {
            console.error('Error fetching directions:', error);
            alert("Error fetching directions. Please try again.");
        });
}

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

function fitRouteToBounds(route) {
    const bounds = new mapboxgl.LngLatBounds();
    route.coordinates.forEach(coord => {
        bounds.extend(coord);
    });
    map.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        pitch: 0
    });
}
