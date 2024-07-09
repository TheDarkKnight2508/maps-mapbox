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

    addTimeOfDayButtons();
}

// Initialize the geocoders
function initializeGeocoders() {
    const bangaloreBounds = [77.3733, 12.7343, 77.8721, 13.1377]; // Approx bounding box for Bangalore
    const karnatakaBounds = [74.0411, 11.5933, 78.5883, 18.4506]; // Approx bounding box for Karnataka
    const indiaBounds = [68.1766, 6.7471, 97.4026, 35.5087]; // Approx bounding box for India

    const geocoderOptions = {
        accessToken: mapboxgl.accessToken,
        mapboxgl: mapboxgl,
        countries: "IN", // Limit results to India
        proximity: { longitude: 77.5946, latitude: 12.9716 }, // Bangalore coordinates for proximity
    };

    const geocoderStart = new MapboxGeocoder({
        ...geocoderOptions,
        bbox: bangaloreBounds, // Bangalore bounding box for first priority
    });

    const geocoderEnd = new MapboxGeocoder({
        ...geocoderOptions,
        bbox: bangaloreBounds, // Bangalore bounding box for first priority
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
 });

    // Modify geocoder options to include broader search results
    geocoderStart.on('results', (e) => {
        if (e.features.length < 1) {
            geocoderStart.setBbox(karnatakaBounds); // Extend search to Karnataka if no results in Bangalore
            geocoderStart.query(e.query); // Re-query with the broader bounding box
        } else if (e.features.length < 3) {
            geocoderStart.setBbox(indiaBounds); // Extend search to India if few results in Karnataka
            geocoderStart.query(e.query); // Re-query with the broader bounding box
        }
    });

    geocoderEnd.on('results', (e) => {
        if (e.features.length < 1) {
            geocoderEnd.setBbox(karnatakaBounds); // Extend search to Karnataka if no results in Bangalore
            geocoderEnd.query(e.query); // Re-query with the broader bounding box
        } else if (e.features.length < 3) {
            geocoderEnd.setBbox(indiaBounds); // Extend search to India if few results in Karnataka
            geocoderEnd.query(e.query); // Re-query with the broader bounding box
        }
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
            
            // Remove any previous start marker
            if (startMarker) {
                startMarker.remove();
                startMarker = null;
            }
            
            // Pan to user location without adding a new start marker
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

            // Calculate the midpoint
            const midpoint = [
                (startCoordinates[0] + endCoordinates[0]) / 2,
                (startCoordinates[1] + endCoordinates[1]) / 2
            ];

            // Perform animations
            setTimeout(() => {
                
                const zoom = map.getZoom() *0.98;

                map.flyTo({
                    center: midpoint,
                    zoom: zoom,
                    pitch: 60,
                    bearing: 0,
                    essential: true,
                    speed: 1.2
                });

                // Rotate the bearing 360 degrees
                setTimeout(() => {
                    let bearing = 0;
                    const rotationInterval = setInterval(() => {
                        bearing += 10;
                        if (bearing >= 360) {
                            clearInterval(rotationInterval);

                            // After rotation, fly back to user's location
                            setTimeout(() => {
                                map.flyTo({
                                    center: startCoordinates,
                                    zoom: 17,
                                    pitch: 60,
                                    essential: true
                                });
                            }, 1000);
                        } else {
                            map.rotateTo(bearing, { duration: 100 });
                        }
                    }, 100);
                }, 2000);
            }, 1000);
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

// Add time of day buttons
function addTimeOfDayButtons() {
    const timeOfDayContainer = document.createElement('div');
    timeOfDayContainer.className = 'mapboxgl-ctrl mapboxgl-ctrl-group time-of-day-buttons';

    const dawnButton = createTimeOfDayButton('dawn', '☀️');
    dawnButton.onclick = () => map.setConfigProperty('basemap', 'lightPreset', 'dawn');
    
    const dayButton = createTimeOfDayButton('day', '🌞');
    dayButton.onclick = () => map.setConfigProperty('basemap', 'lightPreset', 'day');
    
    const duskButton = createTimeOfDayButton('dusk', '🌅');
    duskButton.onclick = () => map.setConfigProperty('basemap', 'lightPreset', 'dusk');
    
    const nightButton = createTimeOfDayButton('night', '🌜');
    nightButton.onclick = () => map.setConfigProperty('basemap', 'lightPreset', 'night');

    timeOfDayContainer.appendChild(dawnButton);
    timeOfDayContainer.appendChild(dayButton);
    timeOfDayContainer.appendChild(duskButton);
    timeOfDayContainer.appendChild(nightButton);

    map.addControl({
        onAdd: () => {
            return timeOfDayContainer;
        },
        onRemove: () => {
            timeOfDayContainer.parentNode.removeChild(timeOfDayContainer);
        }
    }, 'bottom-left');
}

function createTimeOfDayButton(id, text) {
    const button = document.createElement('button');
    button.className = 'mapboxgl-ctrl-icon time-of-day-button';
    button.type = 'button';
    button.id = id;
    button.innerText = text;
    return button;
}

class PitchControl {
    onAdd(map) {
        this.map = map;
        this.container = document.createElement('div');
        this.container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
        this.button = document.createElement('button');
        this.button.className = 'mapboxgl-ctrl-icon';
        this.button.type = 'button';
        this.button.title = 'Adjust pitch';
        this.button.innerHTML = '↕';
        this.button.onclick = () => {
            const currentPitch = this.map.getPitch();
            const newPitch = currentPitch === 60 ? 0 : 60;
            this.map.easeTo({ pitch: newPitch });
        };
        this.container.appendChild(this.button);
        return this.container;
    }

    onRemove() {
        this.container.parentNode.removeChild(this.container);
        this.map = undefined;
    }
}

class BearingControl {
    onAdd(map) {
        this.map = map;
        this.container = document.createElement('div');
        this.container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
        this.button = document.createElement('button');
        this.button.className = 'mapboxgl-ctrl-icon';
        this.button.type = 'button';
        this.button.title = 'Adjust bearing';
        this.button.innerHTML = '⤵';
        this.button.onclick = () => {
            const currentBearing = this.map.getBearing();
            const newBearing = currentBearing === 0 ? 180 : 0;
            this.map.easeTo({ bearing: newBearing });
        };
        this.container.appendChild(this.button);
        return this.container;
    }

    onRemove() {
        this.container.parentNode.removeChild(this.container);
        this.map = undefined;
    }
}

class ZoomControls {
    onAdd(map) {
        this.map = map;
        this.container = document.createElement('div');
        this.container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
        this.zoomInButton = document.createElement('button');
        this.zoomInButton.className = 'mapboxgl-ctrl-icon';
        this.zoomInButton.type = 'button';
        this.zoomInButton.title = 'Zoom in';
        this.zoomInButton.innerHTML = '+';
        this.zoomInButton.onclick = () => this.map.zoomIn();
        this.zoomOutButton = document.createElement('button');
        this.zoomOutButton.className = 'mapboxgl-ctrl-icon';
        this.zoomOutButton.type = 'button';
        this.zoomOutButton.title = 'Zoom out';
        this.zoomOutButton.innerHTML = '−';
        this.zoomOutButton.onclick = () => this.map.zoomOut();
        this.container.appendChild(this.zoomInButton);
        this.container.appendChild(this.zoomOutButton);
        return this.container;
    }

    onRemove() {
        this.container.parentNode.removeChild(this.container);
        this.map = undefined;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeMap();
    initializeGeocoders();
});
