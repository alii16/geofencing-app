// Initialize target location as null, will be set by user
let targetLatitude = null;
let targetLongitude = null;
let radius = 500; // Default radius
let map; // Map for geofence setup
let marker; // Marker for geofence target
let radiusCircle; // Circle for geofence radius

let selectedLat = null;
let selectedLng = null;
let watchId = null; // To store the watchPosition ID

// --- Notifikasi Geofence Kontrol ---
let userInsideGeofence = null; // true: user inside, false: user outside, null: unknown/initial state
let lastNotifiedGeofenceStatus = null; // true: last notification was 'inside', false: 'outside', null: no notification yet
let previousTargetLocation = { lat: null, lng: null }; // To track if target location has changed

// --- New Variables for User Location Map ---
let userMap; // Map for displaying user's current location and geofence
let userMarker; // Marker for user's current location on userMap
let userGeofenceMarker; // Marker for geofence target on userMap
let userRadiusCircle; // Circle for geofence radius on userMap
let userMapInitialized = false;

// URL ini akan menunjuk ke Vercel Function Anda
// Saat development lokal, gunakan '/api/geofence'
// Setelah di-deploy ke Vercel, ini akan tetap '/api/geofence' relatif terhadap root aplikasi Anda
const VERSEL_FUNCTION_URL = "/api/geofence";

// Fungsi untuk mengirim notifikasi ke Telegram melalui Vercel Function
async function sendTelegramNotification(message) {
  try {
    console.log("Sending Telegram notification via Vercel Function...");
    const response = await fetch(VERSEL_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Hanya kirimkan pesan, token dan chat ID sudah di hardcode di geofence.js
        text: message,
      }),
    });

    if (response.ok) {
      console.log("Telegram notification sent successfully!");
    } else {
      const errorData = await response.json();
      console.error("Failed to send Telegram notification:", errorData.error);
      Swal.fire({
        title: "Telegram Error",
        text: `Failed to send Telegram notification (Vercel Function error): ${
          errorData.error || response.statusText
        }`,
        icon: "error",
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 3000,
      });
    }
  } catch (error) {
    console.error("Error sending Telegram notification:", error);
    Swal.fire({
      title: "Network Error",
      text: `Could not connect to Vercel Function: ${error.message}`,
      icon: "error",
      toast: true,
      position: "top-end",
      showConfirmButton: false,
      timer: 6000,
    });
  }
}

// Function to calculate distance between two coordinates in meters
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of Earth in kilometers
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c * 1000; // Distance in meters
  return distance;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

// Update radius from input and re-check geofence
function updateRadius() {
  const radiusInput = document.getElementById("radius-input");
  radius = parseInt(radiusInput.value);
  document.getElementById("current-radius").textContent = radius + " meters";

  // Update the circle on the map if it exists and map is open
  if (
    radiusCircle &&
    map &&
    !document.getElementById("map-modal").classList.contains("hidden")
  ) {
    radiusCircle.setRadius(radius);
  }
  // Also update the circle on the user map if open
  if (
    userRadiusCircle &&
    userMap &&
    !document.getElementById("user-location-modal").classList.contains("hidden")
  ) {
    userRadiusCircle.setRadius(radius);
  }

  // Re-check geofence with new radius if location is available and target is set
  const lat = document.getElementById("lat").textContent;
  const lng = document.getElementById("long").textContent;
  if (targetLatitude !== null && targetLongitude !== null && lat && lng) {
    checkGeofence(parseFloat(lat), parseFloat(lng));
  }
}

// Check geofence status and update UI
function checkGeofence(latitude, longitude) {
  const geofenceStatusElement = document.getElementById("geofence-status");
  const geofenceInfoElement = document.getElementById("geofence-info");
  const statusIndicator = document.getElementById("status-indicator");
  const distanceInfo = document.getElementById("distance-info");

  // Periksa apakah lokasi target telah berubah
  const targetLocationChanged =
    targetLatitude !== previousTargetLocation.lat ||
    targetLongitude !== previousTargetLocation.lng;

  if (targetLatitude === null || targetLongitude === null) {
    geofenceInfoElement.style.display = "none";
    // Reset notifikasi jika target belum disetel
    userInsideGeofence = null;
    lastNotifiedGeofenceStatus = null;
    return;
  }

  // Jika lokasi target berubah, reset status notifikasi
  if (targetLocationChanged) {
    userInsideGeofence = null; // Reset status karena target berubah
    lastNotifiedGeofenceStatus = null; // Reset notifikasi karena target berubah
    previousTargetLocation = {
      lat: targetLatitude,
      lng: targetLongitude,
    }; // Update previous target
  }

  const distance = calculateDistance(
    latitude,
    longitude,
    targetLatitude,
    targetLongitude
  );
  const distanceToEdge = distance - radius;

  distanceInfo.textContent = `Distance to center: ${Math.round(
    distance
  )}m. Distance to edge: ${Math.round(distanceToEdge)}m`;

  let currentlyInside = distance <= radius;

  if (currentlyInside) {
    geofenceStatusElement.innerHTML =
      '<span class="text-green-700">Inside Radius</span>';
    statusIndicator.className = "w-3 h-3 rounded-full bg-green-400";
    geofenceInfoElement.style.display = "block";
    geofenceInfoElement.className =
      "block border-green-200 bg-green-50 p-4 rounded-lg border";

    // Notifikasi hanya jika status berubah dari luar ke dalam ATAU jika ini adalah status awal yang belum dinotifikasi
    if (
      userInsideGeofence === false ||
      (userInsideGeofence === null && lastNotifiedGeofenceStatus !== true)
    ) {
      Swal.fire({
        title: "Selamat Datang!",
        text: "Hai, selamat datang di area yang ditentukan.",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: "top-end",
      });
      // KIRIM NOTIFIKASI TELEGRAM MASUK
      sendTelegramNotification(
        `🔔 Notifikasi Geofence: Anda telah MASUK ke area yang ditentukan!\nLokasi: ${latitude.toFixed(
          6
        )}, ${longitude.toFixed(6)}\nJarak ke pusat: ${Math.round(distance)}m`
      );
      lastNotifiedGeofenceStatus = true; // Tandai bahwa notifikasi "inside" sudah muncul
    }
    userInsideGeofence = true; // Update status pengguna
  } else {
    // Outside radius
    geofenceStatusElement.innerHTML =
      '<span class="text-red-700">Outside Radius</span>';
    statusIndicator.className = "w-3 h-3 rounded-full bg-red-400";
    geofenceInfoElement.style.display = "block";
    geofenceInfoElement.className =
      "block border-red-200 bg-red-50 p-4 rounded-lg border";

    // Notifikasi hanya jika status berubah dari dalam ke luar ATAU jika ini adalah status awal yang belum dinotifikasi
    if (
      userInsideGeofence === true ||
      (userInsideGeofence === null && lastNotifiedGeofenceStatus !== false)
    ) {
      Swal.fire({
        title: "Pemberitahuan",
        text: "Anda berada di luar area yang ditentukan.",
        icon: "info",
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: "top-end",
      });
      // KIRIM NOTIFIKASI TELEGRAM KELUAR
      sendTelegramNotification(
        `❗ Notifikasi Geofence: Anda telah KELUAR dari area yang ditentukan!\nLokasi: ${latitude.toFixed(
          6
        )}, ${longitude.toFixed(6)}\nJarak ke pusat: ${Math.round(distance)}m`
      );
      lastNotifiedGeofenceStatus = false; // Tandai bahwa notifikasi "outside" sudah muncul
    }
    userInsideGeofence = false; // Update status pengguna
  }
}

// Handle successful location update
function locationSuccess(pos) {
  document.getElementById("loader").style.display = "none";
  document.getElementById("location-info").style.display = "block";
  const { latitude, longitude } = pos.coords;
  document.getElementById("lat").textContent = latitude.toFixed(6);
  document.getElementById("long").textContent = longitude.toFixed(6);

  checkGeofence(latitude, longitude);

  // Update user map if it's open
  if (
    !document.getElementById("user-location-modal").classList.contains("hidden")
  ) {
    updateUserMap(latitude, longitude);
  }
}

// Handle location error
function locationError(err) {
  document.getElementById("loader").style.display = "none";
  Swal.fire({
    title: "Location Access Failed",
    text: err.message,
    icon: "error",
    customClass: {
      popup: "rounded-lg",
    },
  });
  stopWatchingLocation(); // Stop tracking if error occurs
}

// Start watching user's location
function startWatchingLocation() {
  if (watchId !== null) {
    Swal.fire({
      title: "Already Tracking",
      text: "Realtime location tracking is already active.",
      icon: "info",
      timer: 2000,
      showConfirmButton: false,
      toast: true,
      position: "top-end",
    });
    return;
  }

  document.getElementById("loader").style.display = "flex";
  document.getElementById("stop-tracking-btn").classList.remove("hidden");
  // Show the new button
  document.getElementById("view-my-location-btn").classList.remove("hidden");

  watchId = navigator.geolocation.watchPosition(
    locationSuccess,
    locationError,
    {
      enableHighAccuracy: true,
      timeout: 5000, // Reduced timeout for faster updates/errors
      maximumAge: 0, // Get fresh location every time
    }
  );

  Swal.fire({
    title: "Tracking Started",
    text: "Realtime location tracking is now active.",
    icon: "success",
    timer: 2000,
    showConfirmButton: false,
    toast: true,
    position: "top-end",
  });
}

// Stop watching user's location
function stopWatchingLocation() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    document.getElementById("loader").style.display = "none";
    document.getElementById("stop-tracking-btn").classList.add("hidden");
    // Hide the new button
    document.getElementById("view-my-location-btn").classList.add("hidden");
    Swal.fire({
      title: "Tracking Stopped",
      text: "Realtime location tracking has been stopped.",
      icon: "info",
      timer: 2000,
      showConfirmButton: false,
      toast: true,
      position: "top-end",
    });
  }
}

let mapInitialized = false;

function openMapModal() {
  document.getElementById("map-modal").classList.remove("hidden");
  // Reset selected coordinates and disable save button on open
  selectedLat = null;
  selectedLng = null;
  document.getElementById("selected-coords").textContent =
    "No location selected";
  document.getElementById("save-location-btn").disabled = true;

  if (!mapInitialized) {
    setTimeout(() => {
      if (typeof google !== "undefined" && google.maps) {
        initMap();
        mapInitialized = true;
      } else {
        console.error("Google Maps API not loaded");
        Swal.fire({
          title: "Maps Error",
          text: "Google Maps could not be loaded. Please check your internet connection and API key.",
          icon: "error",
          customClass: {
            popup: "rounded-lg",
          },
        });
      }
    }, 300); // Small delay to ensure modal is rendered
  } else {
    // If map is already initialized, just recenter it
    if (targetLatitude !== null && targetLongitude !== null) {
      map.setCenter({ lat: targetLatitude, lng: targetLongitude });
      if (marker)
        marker.setPosition({ lat: targetLatitude, lng: targetLongitude });
      else {
        // Recreate marker if it was nullified or removed
        marker = new google.maps.Marker({
          position: { lat: targetLatitude, lng: targetLongitude },
          map: map,
          title: "Current Geofence Location",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: "#8b5cf6",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });
      }
      if (radiusCircle)
        radiusCircle.setCenter({
          lat: targetLatitude,
          lng: targetLongitude,
        });
      else {
        // Recreate circle if it was nullified or removed
        radiusCircle = new google.maps.Circle({
          strokeColor: "#8b5cf6",
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: "#8b5cf6",
          fillOpacity: 0.15,
          map: map,
          center: { lat: targetLatitude, lng: targetLongitude },
          radius: radius,
        });
      }
      document.getElementById(
        "selected-coords"
      ).textContent = `Selected: ${targetLatitude.toFixed(
        6
      )}, ${targetLongitude.toFixed(6)}`;
      document.getElementById("save-location-btn").disabled = false;
    } else {
      // Try to center on current user location if available
      const currentLat = document.getElementById("lat").textContent;
      const currentLng = document.getElementById("long").textContent;
      if (currentLat && currentLng) {
        map.setCenter({
          lat: parseFloat(currentLat),
          lng: parseFloat(currentLng),
        });
      } else {
        map.setCenter({ lat: 0, lng: 0 }); // Default fallback
      }
      // Clear any existing marker/circle if no target set
      if (marker) marker.setMap(null); // Remove from map
      if (radiusCircle) radiusCircle.setMap(null); // Remove from map
      marker = null; // Clear reference
      radiusCircle = null; // Clear reference
    }
    // Ensure map resizes if modal was hidden
    google.maps.event.trigger(map, "resize");
  }
}

function closeMapModal() {
  document.getElementById("map-modal").classList.add("hidden");
}

function initMap() {
  try {
    // Initialize map centered on user's current location if available, otherwise default
    let initialCenter = { lat: 0, lng: 0 }; // Default to equator
    const currentLat = document.getElementById("lat").textContent;
    const currentLng = document.getElementById("long").textContent;

    if (currentLat && currentLng) {
      initialCenter = {
        lat: parseFloat(currentLat),
        lng: parseFloat(currentLng),
      };
    } else if (targetLatitude !== null && targetLongitude !== null) {
      initialCenter = { lat: targetLatitude, lng: targetLongitude };
    }

    map = new google.maps.Map(document.getElementById("map"), {
      zoom: 13,
      center: initialCenter,
      mapTypeControl: true,
      fullscreenControl: false,
      streetViewControl: false,
      styles: [
        {
          featureType: "poi",
          elementType: "labels",
          stylers: [{ visibility: "off" }],
        },
      ],
    });

    // Add marker only if a target location is already set
    if (targetLatitude !== null && targetLongitude !== null) {
      marker = new google.maps.Marker({
        position: { lat: targetLatitude, lng: targetLongitude },
        map: map,
        title: "Current Geofence Location",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#8b5cf6",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });

      radiusCircle = new google.maps.Circle({
        strokeColor: "#8b5cf6",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "#8b5cf6",
        fillOpacity: 0.15,
        map: map,
        center: { lat: targetLatitude, lng: targetLongitude },
        radius: radius,
      });

      document.getElementById(
        "selected-coords"
      ).textContent = `Selected: ${targetLatitude.toFixed(
        6
      )}, ${targetLongitude.toFixed(6)}`;
      document.getElementById("save-location-btn").disabled = false;
    }

    // Add click listener to map
    map.addListener("click", (event) => {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();

      selectedLat = lat;
      selectedLng = lng;

      // Create or update marker position
      if (!marker) {
        marker = new google.maps.Marker({
          position: { lat: lat, lng: lng },
          map: map,
          title: "Selected Geofence Location",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: "#8b5cf6",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });
      } else {
        marker.setPosition({ lat: lat, lng: lng });
      }

      // Create or update circle position
      if (!radiusCircle) {
        radiusCircle = new google.maps.Circle({
          strokeColor: "#8b5cf6",
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: "#8b5cf6",
          fillOpacity: 0.15,
          map: map,
          center: { lat: lat, lng: lng },
          radius: radius,
        });
      } else {
        radiusCircle.setCenter({ lat: lat, lng: lng });
        radiusCircle.setRadius(radius); // Ensure radius is updated if changed via input
      }

      // Update selected coordinates display
      document.getElementById(
        "selected-coords"
      ).textContent = `Selected: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;

      // Enable save button
      document.getElementById("save-location-btn").disabled = false;
    });

    console.log("Map initialized successfully");
  } catch (error) {
    console.error("Error initializing map:", error);
    Swal.fire({
      title: "Maps Error",
      text: "Google Maps could not be loaded. Please try again.",
      icon: "error",
      customClass: {
        popup: "rounded-lg",
      },
    });
  }
}

function saveSelectedLocation() {
  if (selectedLat !== null && selectedLng !== null) {
    targetLatitude = selectedLat;
    targetLongitude = selectedLng;

    // Reset notifikasi status karena lokasi target berubah
    userInsideGeofence = null;
    lastNotifiedGeofenceStatus = null;
    previousTargetLocation = {
      lat: targetLatitude,
      lng: targetLongitude,
    }; // Update previous target

    // Update display
    document.getElementById(
      "target-coords"
    ).textContent = `${targetLatitude.toFixed(6)}, ${targetLongitude.toFixed(
      6
    )}`;

    closeMapModal();

    Swal.fire({
      title: "Location Saved!",
      text: "Geofence location has been updated successfully.",
      icon: "success",
      timer: 2000,
      showConfirmButton: false,
      customClass: {
        popup: "rounded-lg",
      },
    });

    // Re-check geofence if current location is available
    const lat = document.getElementById("lat").textContent;
    const lng = document.getElementById("long").textContent;
    if (lat && lng) {
      checkGeofence(parseFloat(lat), parseFloat(lng));
    }
  }
}

// --- NEW FUNCTIONS FOR USER LOCATION MAP ---
function openUserLocationModal() {
  if (watchId === null) {
    Swal.fire({
      title: "Tracking Not Active",
      text: "Please start realtime location tracking first to view your position on the map.",
      icon: "info",
      timer: 3000,
      showConfirmButton: false,
      toast: true,
      position: "top-end",
    });
    return;
  }

  document.getElementById("user-location-modal").classList.remove("hidden");

  if (!userMapInitialized) {
    setTimeout(() => {
      if (typeof google !== "undefined" && google.maps) {
        initUserMap();
        userMapInitialized = true;
      } else {
        console.error("Google Maps API not loaded for user map");
        Swal.fire({
          title: "Maps Error",
          text: "Google Maps could not be loaded for your location view. Please check your internet connection and API key.",
          icon: "error",
          customClass: {
            popup: "rounded-lg",
          },
        });
      }
    }, 300); // Small delay to ensure modal is rendered
  } else {
    // If map is already initialized, just recenter and update
    const currentLat = parseFloat(document.getElementById("lat").textContent);
    const currentLng = parseFloat(document.getElementById("long").textContent);
    if (!isNaN(currentLat) && !isNaN(currentLng)) {
      userMap.setCenter({ lat: currentLat, lng: currentLng });
      updateUserMap(currentLat, currentLng);
    }
    google.maps.event.trigger(userMap, "resize");
  }
}

function closeUserLocationModal() {
  document.getElementById("user-location-modal").classList.add("hidden");
}

function initUserMap() {
  try {
    const currentLat = parseFloat(document.getElementById("lat").textContent);
    const currentLng = parseFloat(document.getElementById("long").textContent);

    let initialCenter = { lat: 0, lng: 0 };
    if (!isNaN(currentLat) && !isNaN(currentLng)) {
      initialCenter = { lat: currentLat, lng: currentLng };
    } else if (targetLatitude !== null && targetLongitude !== null) {
      initialCenter = { lat: targetLatitude, lng: targetLongitude };
    }

    userMap = new google.maps.Map(document.getElementById("user-map"), {
      zoom: 15,
      center: initialCenter,
      mapTypeControl: true,
      fullscreenControl: false,
      streetViewControl: false,
      styles: [
        {
          featureType: "poi",
          elementType: "labels",
          stylers: [{ visibility: "off" }],
        },
      ],
    });

    // Add user marker
    userMarker = new google.maps.Marker({
      position: initialCenter,
      map: userMap,
      title: "Your Current Location",
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: "#3b82f6", // Primary blue
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      },
      zIndex: 2, // Ensure user marker is above geofence
    });

    // Add geofence marker and circle if target location is set
    if (targetLatitude !== null && targetLongitude !== null) {
      const geofenceCenter = { lat: targetLatitude, lng: targetLongitude };
      userGeofenceMarker = new google.maps.Marker({
        position: geofenceCenter,
        map: userMap,
        title: "Geofence Target",
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, // A different icon for geofence
          scale: 6,
          fillColor: "#8b5cf6", // Purple
          fillOpacity: 0.9,
          strokeColor: "#ffffff",
          strokeWeight: 1,
        },
        zIndex: 1, // Ensure geofence is below user
      });

      userRadiusCircle = new google.maps.Circle({
        strokeColor: "#8b5cf6",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "#8b5cf6",
        fillOpacity: 0.15,
        map: userMap,
        center: geofenceCenter,
        radius: radius,
        zIndex: 0, // Ensure circle is at the bottom layer
      });
    }

    // Initial update of user map info
    updateUserMap(currentLat, currentLng);
    console.log("User map initialized successfully");
  } catch (error) {
    console.error("Error initializing user map:", error);
    document.getElementById("user-map-status-text").textContent =
      "Error loading map. Please try again.";
    document
      .getElementById("user-map-status-text")
      .classList.add("text-red-800", "bg-red-50", "border-red-200");
    document
      .getElementById("user-map-status-text")
      .classList.remove("text-blue-800", "bg-blue-50", "border-blue-200");
  }
}

function updateUserMap(latitude, longitude) {
  if (!userMap || !userMarker) return; // Map or marker not ready

  const userPosition = { lat: latitude, lng: longitude };
  userMarker.setPosition(userPosition);
  userMap.setCenter(userPosition); // Keep user's position centered

  document.getElementById("user-map-coords").textContent = `${latitude.toFixed(
    6
  )}, ${longitude.toFixed(6)}`;

  // Update geofence marker and circle if target is set
  if (targetLatitude !== null && targetLongitude !== null) {
    const distance = calculateDistance(
      latitude,
      longitude,
      targetLatitude,
      targetLongitude
    );
    document.getElementById("user-map-distance").textContent = `${Math.round(
      distance
    )}m`;

    if (!userGeofenceMarker) {
      // Recreate geofence marker if it somehow disappeared
      userGeofenceMarker = new google.maps.Marker({
        position: { lat: targetLatitude, lng: targetLongitude },
        map: userMap,
        title: "Geofence Target",
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: "#8b5cf6",
          fillOpacity: 0.9,
          strokeColor: "#ffffff",
          strokeWeight: 1,
        },
        zIndex: 1,
      });
    } else {
      userGeofenceMarker.setPosition({
        lat: targetLatitude,
        lng: targetLongitude,
      });
    }

    if (!userRadiusCircle) {
      // Recreate radius circle if it somehow disappeared
      userRadiusCircle = new google.maps.Circle({
        strokeColor: "#8b5cf6",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "#8b5cf6",
        fillOpacity: 0.15,
        map: userMap,
        center: { lat: targetLatitude, lng: targetLongitude },
        radius: radius,
        zIndex: 0,
      });
    } else {
      userRadiusCircle.setCenter({ lat: targetLatitude, lng: targetLongitude });
      userRadiusCircle.setRadius(radius);
    }
  } else {
    document.getElementById("user-map-distance").textContent =
      "Geofence not set.";
    // Hide geofence elements if target is not set
    if (userGeofenceMarker) userGeofenceMarker.setMap(null);
    if (userRadiusCircle) userRadiusCircle.setMap(null);
    userGeofenceMarker = null;
    userRadiusCircle = null;
  }
}

// Ask for location permission on page load, then start watching
window.addEventListener("load", () => {
  // Set initial radius display
  document.getElementById("current-radius").textContent = radius + " meters";

  // Set initial target location display
  if (targetLatitude === null || targetLongitude === null) {
    document.getElementById("target-coords").textContent = "Not set";
  } else {
    document.getElementById(
      "target-coords"
    ).textContent = `${targetLatitude.toFixed(6)}, ${targetLongitude.toFixed(
      6
    )}`;
  }

  Swal.fire({
    title: "Location Access",
    text: "Allow this application to access your location for geofence features? This will enable realtime tracking.",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Allow",
    cancelButtonText: "Deny",
    confirmButtonColor: "#3b82f6",
    cancelButtonColor: "#6b7280",
    customClass: {
      popup: "rounded-lg",
    },
  }).then((result) => {
    if (result.isConfirmed) {
      startWatchingLocation();
    } else {
      Swal.fire({
        title: "Access Denied",
        text: "Realtime location tracking disabled. You can still set geofence locations manually.",
        icon: "info",
        customClass: {
          popup: "rounded-lg",
        },
      });
    }
  });
});

// Notification functions
function showSuccess() {
  // Pertama, tampilkan SweetAlert2 seperti biasa
  Swal.fire({
    icon: "success",
    title: "Success!",
    text: "This is a success notification.",
    showConfirmButton: true,
    confirmButtonColor: "#3b82f6",
    customClass: {
      popup: "rounded-lg",
    },
  });

  // --- Logika Notifikasi Browser (langsung di dalam fungsi ini) ---
  // 1. Periksa dukungan API Notifikasi di browser
  if (!("Notification" in window)) {
    console.warn("Browser ini tidak mendukung notifikasi desktop.");
    return; // Hentikan jika tidak didukung
  }

  // 2. Periksa status izin notifikasi
  if (Notification.permission === "granted") {
    // Izin sudah diberikan, langsung tampilkan notifikasi
    new Notification("Success!", {
      body: "This is a success notification from your browser.",
      // Ganti URL ikon ini dengan ikon Anda sendiri jika ada.
      icon: "https://cdn-icons-png.flaticon.com/512/190/190411.png", // Contoh ikon centang hijau
    });
  } else if (Notification.permission !== "denied") {
    // Izin belum diberikan atau diabaikan, minta izin dari pengguna
    Notification.requestPermission().then(function (permission) {
      if (permission === "granted") {
        // Pengguna memberikan izin, tampilkan notifikasi
        new Notification("Success!", {
          body: "This is a success notification from your browser.",
          icon: "https://cdn-icons-png.flaticon.com/512/190/190411.png", // Contoh ikon
        });
      } else {
        // Pengguna menolak izin notifikasi
        console.warn("Pengguna menolak izin notifikasi browser.");
      }
    });
  }
  // --- Akhir Logika Notifikasi Browser ---
}

function showError() {
  // Pertama, tampilkan SweetAlert2 seperti biasa
  Swal.fire({
    icon: "error",
    title: "Error!",
    text: "This is an error notification.",
    footer:
      '<a href="#" class="text-blue-600 hover:text-blue-800">Learn more</a>',
    confirmButtonColor: "#3b82f6",
    customClass: {
      popup: "rounded-lg",
    },
  });

  // --- Logika Notifikasi Browser (langsung di dalam fungsi ini) ---
  // 1. Periksa dukungan API Notifikasi di browser
  if (!("Notification" in window)) {
    console.warn("Browser ini tidak mendukung notifikasi desktop.");
    return; // Hentikan jika tidak didukung
  }

  // 2. Periksa status izin notifikasi
  if (Notification.permission === "granted") {
    // Izin sudah diberikan, langsung tampilkan notifikasi
    new Notification("Error!", {
      // Judul notifikasi browser
      body: "This is an error notification from your browser.", // Isi notifikasi browser
      // Ganti URL ikon ini dengan ikon error Anda sendiri jika ada.
      icon: "https://cdn-icons-png.flaticon.com/512/179/179386.png", // Contoh ikon error/peringatan
    });
  } else if (Notification.permission !== "denied") {
    // Izin belum diberikan atau diabaikan, minta izin dari pengguna
    Notification.requestPermission().then(function (permission) {
      if (permission === "granted") {
        // Pengguna memberikan izin, tampilkan notifikasi
        new Notification("Error!", {
          // Judul notifikasi browser
          body: "This is an error notification from your browser.", // Isi notifikasi browser
          icon: "https://cdn-icons-png.flaticon.com/512/179/179386.png", // Contoh ikon
        });
      } else {
        // Pengguna menolak izin notifikasi
        console.warn("Pengguna menolak izin notifikasi browser.");
      }
    });
  }
  // --- Akhir Logika Notifikasi Browser ---
}

function showInfo() {
  // Pertama, tampilkan SweetAlert2 seperti biasa
  Swal.fire({
    icon: "info",
    title: "Information",
    text: "Announcement: The Mid-Semester Exam will begin on June 10, 2025",
    confirmButtonColor: "#3b82f6",
    customClass: {
      popup: "rounded-lg",
    },
  });

  // --- Logika Notifikasi Browser (langsung di dalam fungsi ini) ---
  // 1. Periksa dukungan API Notifikasi di browser
  if (!("Notification" in window)) {
    console.warn("Browser ini tidak mendukung notifikasi desktop.");
    return; // Hentikan jika tidak didukung
  }

  // 2. Periksa status izin notifikasi
  if (Notification.permission === "granted") {
    // Izin sudah diberikan, langsung tampilkan notifikasi
    new Notification("Information", {
      // Judul notifikasi browser
      body: "Announcement: The Mid-Semester Exam will begin on June 10, 2025", // Isi notifikasi browser
      // Ganti URL ikon ini dengan ikon info Anda sendiri jika ada.
      icon: "https://cdn-icons-png.flaticon.com/512/117/117320.png", // Contoh ikon info
    });
  } else if (Notification.permission !== "denied") {
    // Izin belum diberikan atau diabaikan, minta izin dari pengguna
    Notification.requestPermission().then(function (permission) {
      if (permission === "granted") {
        // Pengguna memberikan izin, tampilkan notifikasi
        new Notification("Information", {
          // Judul notifikasi browser
          body: "Announcement: The Mid-Semester Exam will begin on June 10, 2025", // Isi notifikasi browser
          icon: "https://cdn-icons-png.flaticon.com/128/9195/9195785.png", // Contoh ikon
        });
      } else {
        // Pengguna menolak izin notifikasi
        console.warn("Pengguna menolak izin notifikasi browser.");
      }
    });
  }
  // --- Akhir Logika Notifikasi Browser ---
}

function showWarning() {
  // Pertama, tampilkan SweetAlert2 sebagai peringatan
  Swal.fire({
    icon: "warning",
    title: "Warning!", // Judul peringatan
    text: "Input validation failed. Please check the entered data.", // Pesan peringatan yang relevan
    showConfirmButton: true, // Biarkan tombol OK
    confirmButtonColor: "#3b82f6", // Warna tombol OK standar (biru)
    customClass: {
      popup: "rounded-lg",
    },
    // Menghapus showCancelButton, confirmButtonText, cancelButtonText, dan .then() block
    // karena ini bukan lagi konfirmasi
  });

  // --- Logika Notifikasi Browser (langsung di dalam fungsi ini) ---
  // Akan muncul bersamaan dengan SweetAlert peringatan
  if (!("Notification" in window)) {
    console.warn("Browser ini tidak mendukung notifikasi desktop.");
    return;
  }

  if (Notification.permission === "granted") {
    new Notification("Warning!", {
      // Judul notifikasi browser
      body: "Input validation failed. Please check the entered data.", // Isi notifikasi browser
      icon: "https://cdn-icons-png.flaticon.com/512/179/179386.png", // Ikon peringatan (segitiga/tanda seru)
    });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(function (permission) {
      if (permission === "granted") {
        new Notification("Warning!", {
          body: "Input validation failed. Please check the entered data.",
          icon: "https://cdn-icons-png.flaticon.com/512/179/179386.png",
        });
      } else {
        console.warn("Pengguna menolak izin notifikasi browser.");
      }
    });
  }
  // --- Akhir Logika Notifikasi Browser ---
}

function showConfirmation() {
  Swal.fire({
    icon: "warning",
    title: "Are you sure you want to delete?",
    text: "Deleted data cannot be recovered!",
    showCancelButton: true,
    confirmButtonColor: "#dc2626",
    cancelButtonColor: "#6b7280",
    confirmButtonText: "Delete",
    cancelButtonText: "Cancel",
    customClass: {
      popup: "rounded-lg",
    },
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: "Deleted!",
        text: "Data has been successfully deleted.",
        icon: "success",
        confirmButtonColor: "#3b82f6",
        customClass: {
          popup: "rounded-lg",
        },
      });
    }
  });
}

function showFileUpload() {
  Swal.fire({
    title: "Upload Your File",
    html: `
      <div id="drop-area" style="
        border: 2px dashed #ccc;
        border-radius: 8px;
        padding: 40px;
        text-align: center;
        margin-top: 20px;
        cursor: pointer;
        background-color: #f9f9f9;
        transition: background-color 0.3s ease, border-color 0.3s ease;
      "
      onmouseover="this.style.backgroundColor='#f0f0f0'; this.style.borderColor='#a0a0a0';"
      onmouseout="this.style.backgroundColor='#f9f9f9'; this.style.borderColor='#ccc';"
      ondragover="event.preventDefault(); this.style.backgroundColor='#e0e0e0'; this.style.borderColor='#888';"
      ondragleave="this.style.backgroundColor='#f9f9f9'; this.style.borderColor='#ccc';"
      ondrop="event.preventDefault(); handleDrop(event);">
        <i class="fas fa-cloud-upload-alt" style="font-size: 48px; color: #666; margin-bottom: 15px;"></i>
        <p style="font-size: 1.1em; color: #555; margin-bottom: 10px;">Drag & Drop your file here</p>
        <p style="font-size: 0.9em; color: #888; margin-bottom: 15px;">or click to browse</p>
        <input type="file" id="swal-file-input" accept="image/*" style="display: none;" onchange="handleFileSelect(this.files)">
        <button type="button" onclick="document.getElementById('swal-file-input').click()" style="
          background-color: #007bff;
          color: white;
          padding: 10px 20px;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-size: 1em;
          transition: background-color 0.2s ease;
        "
        onmouseover="this.style.backgroundColor='#0056b3';"
        onmouseout="this.style.backgroundColor='#007bff';">
          Browse Files
        </button>
        <p id="file-name-display" style="margin-top: 15px; font-weight: 500; color: #333;"></p>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Upload",
    showLoaderOnConfirm: true,
    preConfirm: () => {
      const fileInput = Swal.getPopup().querySelector("#swal-file-input");
      const file = fileInput.files[0];

      if (!file) {
        Swal.showValidationMessage("No file selected. Please choose a file.");
        return false; // Prevent modal from closing
      }

      return new Promise((resolve) => {
        // Simulate file upload process
        setTimeout(() => {
          Swal.fire({
            title: "File Uploaded!",
            text: `Your file "${file.name}" has been uploaded successfully.`,
            icon: "success",
          });
          resolve();
        }, 1500);
      });
    },
    didOpen: () => {
      // Event listener for clicks on the custom drop area
      const dropArea = Swal.getPopup().querySelector("#drop-area");
      dropArea.addEventListener("click", () => {
        document.getElementById("swal-file-input").click();
      });
    },
  });
}

// Helper function to handle file selection (from browse or drag-and-drop)
function handleFileSelect(files) {
  const fileNameDisplay = Swal.getPopup().querySelector("#file-name-display");
  if (files.length > 0) {
    fileNameDisplay.textContent = `Selected: ${files[0].name}`;
  } else {
    fileNameDisplay.textContent = "";
  }
}

// Helper function for drag-and-drop
function handleDrop(event) {
  const fileInput = Swal.getPopup().querySelector("#swal-file-input");
  fileInput.files = event.dataTransfer.files;
  handleFileSelect(event.dataTransfer.files);

  // Reset background color after drop
  const dropArea = Swal.getPopup().querySelector("#drop-area");
  dropArea.style.backgroundColor = "#f9f9f9";
  dropArea.style.borderColor = "#ccc";
}

function showCategorySelection() {
  const categories = {
    elektronik: "Elektronik & Gadget",
    fashion: "Fashion",
    food: "Food & Beverage",
    otomotif: "Otomotif",
    home: "Home & Decoration", // Added a new category for more options
    sport: "Sport & Hobby", // Added another new category
  };

  let htmlContent = `<div style="text-align: left; margin-top: 15px;">`;
  for (const [key, value] of Object.entries(categories)) {
    htmlContent += `
      <div style="margin-bottom: 12px;">
        <input type="radio" id="category-${key}" name="category" value="${key}" class="swal2-radio-custom" style="display: none;">
        <label for="category-${key}" style="
          display: inline-flex;
          align-items: center;
          padding: 10px 15px;
          border: 1px solid #dcdcdc;
          border-radius: 8px;
          cursor: pointer;
          font-size: 1em;
          color: #333;
          background-color: #ffffff;
          transition: all 0.2s ease;
          width: 100%; /* Make labels fill width */
          box-sizing: border-box;
        "
        onmouseover="this.style.borderColor='#888'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)';"
        onmouseout="this.style.borderColor='#dcdcdc'; this.style.boxShadow='none';"
        >
          <span style="
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 2px solid #bbb;
            border-radius: 50%;
            margin-right: 12px;
            position: relative;
            flex-shrink: 0;
            background-color: #fff;
            transition: all 0.2s ease;
          ">
            <span class="checked-circle" style="
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) scale(0);
              width: 10px;
              height: 10px;
              border-radius: 50%;
              background-color: #007bff; /* Primary color for checked state */
              transition: transform 0.2s ease;
            "></span>
          </span>
          <span style="font-weight: 500;">${value}</span>
        </label>
      </div>
    `;
  }
  htmlContent += `</div>`;

  Swal.fire({
    title: "Select Product Category",
    text: "Choose one category that best describes your product.",
    html: htmlContent,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Confirm",
    cancelButtonText: "Cancel",
    preConfirm: () => {
      const selectedRadio = Swal.getPopup().querySelector(
        'input[name="category"]:checked'
      );
      if (!selectedRadio) {
        Swal.showValidationMessage("Please select a category to proceed.");
        return false; // Prevent modal from closing
      }
      return selectedRadio.value;
    },
    didOpen: () => {
      // Add event listeners to update custom radio button appearance
      const radios = Swal.getPopup().querySelectorAll(".swal2-radio-custom");
      radios.forEach((radio) => {
        radio.addEventListener("change", () => {
          radios.forEach((r) => {
            const labelSpan = r.nextElementSibling.querySelector("span");
            const checkedCircle = labelSpan.querySelector(
              "span.checked-circle"
            ); // Select specific span
            if (r.checked) {
              labelSpan.style.borderColor = "#007bff"; // Highlight border on checked
              labelSpan.style.boxShadow = "0 0 0 3px rgba(0, 123, 255, 0.25)"; // Add focus-like shadow
              if (checkedCircle)
                checkedCircle.style.transform =
                  "translate(-50%, -50%) scale(1)";
            } else {
              labelSpan.style.borderColor = "#dcdcdc";
              labelSpan.style.boxShadow = "none";
              if (checkedCircle)
                checkedCircle.style.transform =
                  "translate(-50%, -50%) scale(0)";
            }
          });
        });
      });
    },
  }).then((result) => {
    if (result.isConfirmed) {
      // Get the display text for the selected category
      const selectedCategoryKey = result.value;
      const selectedCategoryText = categories[selectedCategoryKey];

      Swal.fire({
        title: "Category Selected!",
        html: `You have successfully selected: <b>${selectedCategoryText}</b>`,
        icon: "success",
        confirmButtonText: "Got it!",
      });
    }
  });
}

function showLoginForm() {
  Swal.fire({
    title: "Welcome Back!",
    html: `
      <div style="padding: 10px 0; display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <p style="color: #6B7280; font-size: 0.95em; margin-bottom: 20px;">Please enter your credential.</p>

        <div style="width: 100%; text-align: left; margin-bottom: 15px;">
          <label for="swal-input-username" style="display: block; margin-bottom: 8px; font-size: 0.875rem; font-weight: 500; color: #374151;">
            Username
          </label>
          <input
            type="text"
            id="swal-input-username"
            class="swal2-input"
            placeholder="Enter your username"
            required
            style="
              background-color: #F9FAFB;
              border: 1px solid #D1D5DB;
              color: #111827;
              font-size: 0.875rem;
              border-radius: 0.5rem; /* 8px */
              display: block;
              width: 100%;
              padding: 0.625rem 1rem; /* 10px 16px */
              box-shadow: none;
              outline: none;
              transition: border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
            "
            onfocus="this.style.borderColor='#2563EB'; this.style.boxShadow='0 0 0 4px rgba(59, 130, 246, 0.25)';"
            onblur="this.style.borderColor='#D1D5DB'; this.style.boxShadow='none';"
          >
        </div>

        <div style="width: 100%; text-align: left; margin-bottom: 20px;">
          <label for="swal-input-password" style="display: block; margin-bottom: 8px; font-size: 0.875rem; font-weight: 500; color: #374151;">
            Password
          </label>
          <input
            type="password"
            id="swal-input-password"
            class="swal2-input"
            placeholder="Enter your password"
            required
            style="
              background-color: #F9FAFB;
              border: 1px solid #D1D5DB;
              color: #111827;
              font-size: 0.875rem;
              border-radius: 0.5rem; /* 8px */
              display: block;
              width: 100%;
              padding: 0.625rem 1rem; /* 10px 16px */
              box-shadow: none;
              outline: none;
              transition: border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
            "
            onfocus="this.style.borderColor='#2563EB'; this.style.boxShadow='0 0 0 4px rgba(59, 130, 246, 0.25)';"
            onblur="this.style.borderColor='#D1D5DB'; this.style.boxShadow='none';"
          >
        </div>

        <a href="#" onclick="Swal.close(); showForgotPassword();" style="font-size: 0.875rem; color: #2563EB; text-decoration: none; margin-top: -10px; margin-bottom: 20px; text-align: right; width: 100%;">Lupa Password?</a>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Login",
    cancelButtonText: "Cancel",
    showLoaderOnConfirm: true,
    allowOutsideClick: () => !Swal.isLoading(),
    allowEscapeKey: () => !Swal.isLoading(),
    preConfirm: () => {
      const username = Swal.getPopup().querySelector(
        "#swal-input-username"
      ).value;
      const password = Swal.getPopup().querySelector(
        "#swal-input-password"
      ).value;

      if (!username || !password) {
        Swal.showValidationMessage("Please enter both username and password.");
        return false;
      }

      return new Promise((resolve) => {
        setTimeout(() => {
          if (username === "user" && password === "password") {
            resolve({ success: true, message: "Login Success!" });
          } else {
            resolve({
              success: false,
              message: "Username or password is wrong!",
            });
          }
        }, 2000);
      });
    },
  }).then((result) => {
    if (result.isConfirmed) {
      if (result.value.success) {
        Swal.fire({
          title: "Login Succes!",
          text: result.value.message,
          icon: "success",
          timer: 2000,
          timerProgressBar: true,
        });
      } else {
        Swal.fire({
          title: "Login Failed!",
          text: result.value.message,
          icon: "error",
        });
      }
    }
  });
}

function showProgressBar() {
  let timerInterval;
  let downloadNotification; // Variabel untuk menyimpan objek notifikasi awal

  // --- Notifikasi Browser Awal: "Sedang Mengunduh..." ---
  // Periksa dukungan dan izin notifikasi sebelum membuat notifikasi awal
  if (!("Notification" in window)) {
    console.warn("Browser ini tidak mendukung notifikasi desktop.");
    // Tidak ada notifikasi browser yang akan ditampilkan
  } else if (Notification.permission === "granted") {
    // Izin sudah diberikan, tampilkan notifikasi "Downloading..."
    downloadNotification = new Notification("Downloading...", {
      body: "Your file is currently being downloaded.",
      icon: "https://cdn-icons-png.flaticon.com/128/179/179375.png", // Ikon download
      tag: "download-progress", // Penting: Gunakan tag untuk mengidentifikasi notifikasi ini
    });
  } else if (Notification.permission !== "denied") {
    // Jika izin belum diberikan/ditolak, minta izin.
    // Jika diizinkan, baru tampilkan notifikasi.
    Notification.requestPermission().then(function (permission) {
      if (permission === "granted") {
        downloadNotification = new Notification("Downloading...", {
          body: "Your file is currently being downloaded.",
          icon: "https://cdn-icons-png.flaticon.com/128/179/179375.png",
          tag: "download-progress",
        });
      }
      // Jika ditolak, konsol warn sudah akan menanganinya
    });
  }
  // --- Akhir Notifikasi Browser Awal ---

  // SweetAlert2 progress bar
  Swal.fire({
    title: "Downloading...", // Judul diubah menjadi "Downloading..."
    html: "File is downloading... <br> This will close in <b></b> milliseconds.", // Pesan diubah
    timer: 10000, // Waktu timer (sesuaikan jika perlu)
    timerProgressBar: true,
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
      const b = Swal.getHtmlContainer().querySelector("b");
      timerInterval = setInterval(() => {
        b.textContent = Swal.getTimerLeft();
      }, 100);
    },
    willClose: () => {
      clearInterval(timerInterval);
    },
  }).then((result) => {
    if (result.dismiss === Swal.DismissReason.timer) {
      // Opsional: Tutup notifikasi "Downloading..." yang pertama jika masih ada
      // (Ini akan diganti oleh notifikasi completion yang menggunakan tag yang sama)
      if (downloadNotification) {
        downloadNotification.close();
      }

      // SweetAlert "Download Complete!" muncul di sini
      Swal.fire(
        "Download Complete!", // Judul SweetAlert setelah selesai
        "The file has been successfully downloaded.", // Pesan SweetAlert setelah selesai
        "success"
      );

      // --- Notifikasi Browser Akhir: "Download Complete!" ---
      // Hanya tampilkan jika izin notifikasi sudah diberikan.
      // Tidak perlu meminta izin lagi karena sudah dilakukan di awal.
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Download Complete!", {
          // Judul notifikasi browser
          body: "The file has been successfully downloaded.", // Isi notifikasi browser
          icon: "https://cdn-icons-png.flaticon.com/512/190/190411.png", // Ikon sukses (centang hijau)
          tag: "download-progress", // Penting: Gunakan tag yang sama untuk mengganti notifikasi sebelumnya
        });
      }
      // --- Akhir Notifikasi Browser Akhir ---
    }
  });
}

// Fungsi placeholder untuk "Lupa Password?"
function showForgotPassword() {
  Swal.fire({
    title: "Forgot Password?",
    input: "email",
    inputPlaceholder: "Enter your email address",
    confirmButtonText: "Reset Password",
    showCancelButton: true,
    preConfirm: (email) => {
      if (!email) {
        Swal.showValidationMessage("Please enter your email address.");
      } else if (!/\S+@\S+\.\S/.test(email)) {
        Swal.showValidationMessage("Please enter a valid email address.");
      }
      return email;
    },
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire(
        "Reset Password Link Sent",
        `Reset password link has sent to ${result.value}`,
        "info"
      );
    }
  });
}

function showCustomAlert() {
  Swal.fire({
    title: "🎉 Great Job!",
    html: `
      <div class="text-center p-3">
        <img 
          src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png" 
          alt="achievement badge" 
          class="w-20 h-20 mx-auto mb-4 rounded-full p-2 bg-yellow-100 border border-yellow-300 shadow-inner" 
        >
        <p class="text-lg text-gray-800 font-semibold mb-1">You've completed <strong class="text-primary-600">5 modules</strong> this week!</p>
        <p class="text-base text-gray-600 mb-4">Your learning progress is now at <strong class="text-green-600">85%</strong> 📈</p>
        <p class="text-sm text-gray-500 mt-3">Keep up the excellent work! 💪</p>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "View Certificate",
    cancelButtonText: "Close",
    customClass: {
      popup:
        "rounded-xl shadow-lg border border-gray-100 transition-all duration-300",
      title: "text-2xl font-bold text-gray-900 pb-2",
      htmlContainer: "text-base leading-relaxed text-gray-700",
      // MENAMBAHKAN INI: Kelas untuk kontainer tombol
      actions: "space-x-4", // Memberi jarak 4 unit antar tombol
      confirmButton:
        "bg-primary-600 text-white px-6 py-2.5 rounded-lg text-base font-semibold hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-200",
      cancelButton:
        "bg-gray-200 text-gray-800 px-6 py-2.5 rounded-lg text-base font-medium hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-colors duration-200",
    },
    buttonsStyling: false,
  });
}

// Fungsi pembantu untuk menampilkan modal rapat interaktif
function showInteractiveMeetingModal() {
  Swal.fire({
    title: "Undangan Rapat",
    text: "Anda mendapat undangan rapat penting. Apakah Anda akan menerima atau menolak?",
    icon: "question", // Menggunakan ikon pertanyaan
    showCancelButton: true, // Menampilkan tombol "Tutup"
    showDenyButton: true, // Menampilkan tombol "Tolak"
    confirmButtonText: "Terima", // Teks tombol "Terima"
    denyButtonText: "Tolak", // Teks tombol "Tolak"
    cancelButtonText: "Tutup", // Teks tombol "Tutup" (opsional, untuk menutup tanpa aksi)
    confirmButtonColor: "#3b82f6", // Warna biru untuk Terima
    denyButtonColor: "#dc2626", // Warna merah untuk Tolak
    cancelButtonColor: "#6b7280", // Warna abu-abu untuk Tutup
    allowOutsideClick: false, // Tidak bisa ditutup dengan klik di luar modal
    customClass: {
      popup: "rounded-lg",
    },
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire("Berhasil!", "Anda menerima undangan rapat.", "success");
      // TODO: Tambahkan logika di sini untuk mengirim status 'Terima' ke backend Anda
      console.log("Pengguna menerima undangan rapat.");
    } else if (result.isDenied) {
      Swal.fire("Ditolak", "Anda menolak undangan rapat.", "error");
      // TODO: Tambahkan logika di sini untuk mengirim status 'Tolak' ke backend Anda
      console.log("Pengguna menolak undangan rapat.");
    } else {
      // result.dismiss === Swal.DismissReason.cancel atau 'backdrop'
      Swal.fire("Ditutup", "Anda menutup undangan rapat tanpa tindakan.", "info");
      console.log("Pengguna menutup modal tanpa tindakan.");
    }
  });
}

// Fungsi utama yang memicu notifikasi dan modal interaktif
// Helper function to display the interactive meeting modal
function showInteractiveMeetingModal() {
  Swal.fire({
    title: "Meeting Invitation", // Translated
    text: "You have an important meeting invitation. Will you accept or decline?", // Translated
    icon: "question",
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: "Accept", // Translated
    denyButtonText: "Declined", // Translated
    cancelButtonText: "Close", // Translated
    confirmButtonColor: "#3b82f6",
    denyButtonColor: "#dc2626",
    cancelButtonColor: "#6b7280",
    allowOutsideClick: false,
    customClass: {
      popup: "rounded-lg",
    },
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire("Success!", "You accepted the meeting invitation.", "success"); // Translated
      // TODO: Add logic here to send 'Accept' status to your backend
      console.log("User accepted the meeting invitation."); // Translated
    } else if (result.isDenied) {
      Swal.fire("Declined", "You declined the meeting invitation.", "error"); // Translated
      // TODO: Add logic here to send 'Declined' status to your backend
      console.log("User declined the meeting invitation."); // Translated
    } else {
      // result.dismiss === Swal.DismissReason.cancel or 'backdrop'
      Swal.fire("Closed", "You closed the meeting invitation without action.", "info"); // Translated
      console.log("User closed the modal without action."); // Translated
    }
  });
}

// Main function that triggers the interactive notification and modal
function showInteractiveNotification() {
  const meetingTitle = "Meeting Invitation"; // Translated
  const meetingBody = "You have a meeting invitation. Click to respond!"; // Translated
  // Example meeting icon (you can change this URL)
  const meetingIcon = 'https://cdn-icons-png.flaticon.com/128/2559/2559028.png';

  // --- Browser Interactive Notification ---
  if (!("Notification" in window)) {
    console.warn("This browser does not support desktop notifications."); // Translated
  } else if (Notification.permission === "granted") {
    const notification = new Notification(meetingTitle, {
      body: meetingBody,
      icon: meetingIcon,
      tag: 'meeting-invite' // Using tag to manage/update this notification
    });

    // Adding an event listener when the browser notification is clicked
    notification.onclick = function(event) {
      event.preventDefault();
      window.focus(); // Ensure the application tab is in focus
      this.close(); // Close the browser notification after it's clicked
      showInteractiveMeetingModal(); // Display the SweetAlert modal again
    };

  } else if (Notification.permission !== "denied") {
    // Request notification permission if not yet granted/denied
    Notification.requestPermission().then(function (permission) {
      if (permission === "granted") {
        const notification = new Notification(meetingTitle, {
          body: meetingBody,
          icon: meetingIcon,
          tag: 'meeting-invite'
        });
        notification.onclick = function(event) {
          event.preventDefault();
          window.focus();
          this.close();
          showInteractiveMeetingModal();
        };
      } else {
        console.warn("User denied browser notification permission."); // Translated
      }
    });
  }

  // --- SweetAlert2 Interactive Modal (will appear immediately) ---
  // This modal will appear initially, and also if the browser notification is clicked
  showInteractiveMeetingModal();
}
