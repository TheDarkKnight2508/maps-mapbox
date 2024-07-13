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

    map.on('load', () => {
        map.addSource('traffic', {
            type: 'vector',
            url: 'mapbox://mapbox.mapbox-traffic-v1'
        });
    
        const congestionTypes = ['moderate', 'heavy', 'severe'];
        const colors = {
            'moderate': '#ffc107',
            'heavy': '#dc3545',
            'severe': '#8b0000'
        };
    
        // Add moderate, heavy, and severe congestion layers
        congestionTypes.forEach(type => {
            map.addLayer({
                id: `traffic-${type}`,
                type: 'line',
                source: 'traffic',
                'source-layer': 'traffic',
                filter: ['==', ['get', 'congestion'], type],
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': colors[type],
                    'line-width': 7
                }
            });
        });
    });

    map.addControl(geolocate, 'top-right');

    map.addControl(new PanToRouteControl(), 'top-right');
    map.addControl(new PitchControl(), 'bottom-right');
    map.addControl(new BearingControl(), 'bottom-right');
    map.addControl(new ZoomControls(), 'bottom-right');

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
    addTimeOfDayDropdown();
    addMapStyleDropdown();
}

// Initialize the geocoders
function initializeGeocoders() {

    const geocoderOptions = {
        accessToken: mapboxgl.accessToken,
        mapboxgl: mapboxgl,
        proximity: { longitude: 77.5946, latitude: 12.9716 }, // Bangalore coordinates for proximity
    };

    const geocoderStart = new MapboxGeocoder({
        ...geocoderOptions
    });

    const geocoderEnd = new MapboxGeocoder({
        ...geocoderOptions
    });

    // Append geocoders to the DOM
    document.getElementById('geocoder-start').appendChild(geocoderStart.onAdd(map));
    document.getElementById('geocoder-end').appendChild(geocoderEnd.onAdd(map));

    // Handle results from the geocoders
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
// Use user location as starting location
function useUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            startCoordinates = [position.coords.longitude, position.coords.latitude];
            
            // Remove any previous start marker
            if (startMarker) {
                startMarker.remove();
                startMarker = null;
            }
            
            // Add a new start marker at the user's location
            addStartMarker(startCoordinates);

            // Pan to user location
            panToLocation(startCoordinates);
            
            // Clear and set the geocoder input with the user's location
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

function setTimeBasedMapStyleInitial() {
    let now = new Date();
    let hours = formatTime(now.getHours());
    let minutes = formatTime(now.getMinutes());
    let seconds = formatTime(now.getSeconds());
    
    console.log(`Current Time: ${hours}:${minutes}:${seconds}`);

    if (hours >= 5 && hours < 8) {
            map.setConfigProperty('basemap', 'lightPreset', 'dawn');
            updateDropdownIcon('dawn');
    } else if (hours >= 8 && hours < 17) {
            map.setConfigProperty('basemap', 'lightPreset', 'day');
            updateDropdownIcon('day');
    } else if (hours >= 17 && hours < 20) {
            map.setConfigProperty('basemap', 'lightPreset', 'dusk');
            updateDropdownIcon('dusk');
    } else {
            map.setConfigProperty('basemap', 'lightPreset', 'night');
            updateDropdownIcon('night');
    }
}

function updateTimeBasedMapStyle() {
    let now = new Date();
    let hours = formatTime(now.getHours());
    let minutes = formatTime(now.getMinutes());
    let seconds = formatTime(now.getSeconds());
    
    console.log(`Current Time: ${hours}:${minutes}:${seconds}`);

    if (hours == 5 && minutes == 0) {
            map.setConfigProperty('basemap', 'lightPreset', 'dawn');
            updateDropdownIcon('dawn');
    } else if (hours == 8 && minutes == 0) {
            map.setConfigProperty('basemap', 'lightPreset', 'day');
            updateDropdownIcon('day');
    } else if (hours == 17 && minutes == 0) {
            map.setConfigProperty('basemap', 'lightPreset', 'dusk');
            updateDropdownIcon('dusk');
    } else if (hours == 20 && minutes == 0) {
            map.setConfigProperty('basemap', 'lightPreset', 'night');
            updateDropdownIcon('night');
    }
}

// Start periodic updates for the map style based on time
function startPeriodicTimeUpdates() {
    setInterval(updateTimeBasedMapStyle, 60000);
}
function formatTime(number) {
    return number < 10 ? '0' + number : number;
}

document.addEventListener('DOMContentLoaded', () => {
    initializeGeocoders();
    initializeMap();
    setTimeout(setTimeBasedMapStyleInitial,500);
    startPeriodicTimeUpdates();   
});
