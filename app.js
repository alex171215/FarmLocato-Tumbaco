const bottomSheet = document.getElementById('bottom-sheet');

const surOeste = L.latLng(-0.2500, -78.4500);
const norEste = L.latLng(-0.1800, -78.3500);
const limitesTumbaco = L.latLngBounds(surOeste, norEste);

const map = L.map('map', {
    center: [-0.2135, -78.4025],
    zoom: 15,
    minZoom: 15,
    maxZoom: 18,
    maxBounds: limitesTumbaco,
    maxBoundsViscosity: 1.0,
    zoomControl: false,
    tap: false
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

// Cierre al tocar el mapa
map.on('click', () => {
    bottomSheet.classList.remove('activo');
    document.querySelectorAll('.pin-medico').forEach(p => p.classList.remove('pin-activo'));
});

// Cierre mediante Swipe Down (Deslizamiento)
let startY = 0;
bottomSheet.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
}, { passive: true });

bottomSheet.addEventListener('touchmove', (e) => {
    const currentY = e.touches[0].clientY;
    if (currentY - startY > 40) { // Si desliza más de 40px hacia abajo
        bottomSheet.classList.remove('activo');
        document.querySelectorAll('.pin-medico').forEach(p => p.classList.remove('pin-activo'));
    }
}, { passive: true });

// ==========================================
// ÍCONOS
// ==========================================
const iconoFarmacia = L.divIcon({
    className: 'pin-wrapper',
    html: '<div class="pin-medico"></div>',
    iconSize: [48, 48],
    iconAnchor: [24, 24]
});

const iconoUsuario = L.divIcon({
    className: 'user-marker',
    html: `<div class="user-pulse"></div><div class="user-dot"></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
});

// ==========================================
// VARIABLES GLOBALES
// ==========================================
const centroTumbaco = [-0.2135, -78.4025];
let ubicacionActiva = centroTumbaco;
let userMarker = null;
let markersGroup = L.layerGroup().addTo(map);
let estaBuscando = false;
const btnGPS = document.getElementById('btn-activar-gps');

// ==========================================
// UTILIDADES UI Y MATEMÁTICAS
// ==========================================
function mostrarAviso(mensaje) {
    const aviso = document.getElementById('aviso-ubicacion');
    const txt = document.getElementById('txt-aviso');
    if (aviso && txt) {
        txt.textContent = mensaje;
        aviso.classList.remove('oculto');
        setTimeout(() => aviso.classList.add('oculto'), 5000);
    }
}

function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ==========================================
// RENDERIZADO DEL BOTTOM SHEET
// ==========================================
function mostrarBottomSheet(farmacia) {
    const tags = farmacia.tags || {};
    document.getElementById('bs-nombre').textContent = tags.name || "Farmacia sin nombre";

    const latlngUsuario = L.latLng(ubicacionActiva[0], ubicacionActiva[1]);
    const latlngFarmacia = L.latLng(farmacia.lat, farmacia.lon);
    const distanciaCalculada = Math.round(map.distance(latlngUsuario, latlngFarmacia));
    document.getElementById('bs-distancia').textContent = "Distancia radial: Aprox. " + distanciaCalculada + " m";

    const contenedorHorario = document.getElementById('contenedor-horario');
    const elemEstado = document.getElementById('bs-estado');
    const elemHorario = document.getElementById('bs-horario');

    if (tags.opening_hours) {
        contenedorHorario.style.display = 'block';
        if (tags.opening_hours === "24/7") {
            elemEstado.textContent = "Abierto 24h";
            elemEstado.style.color = "var(--color-verde-whatsapp)";
            elemHorario.style.display = 'none';
        } else {
            elemEstado.textContent = "";
            elemHorario.style.display = 'block';
            elemHorario.textContent = "Horario: " + tags.opening_hours;
        }
    } else {
        contenedorHorario.style.display = 'none';
    }

    const elemContacto = document.getElementById('btn-contacto');
    const txtContacto = document.getElementById('text-contacto');
    let telefono = tags.phone || tags['contact:phone'] || tags['contact:mobile'] || "";

    if (!telefono) {
        elemContacto.style.display = 'none';
    } else {
        elemContacto.style.display = 'flex';
        let telLimpio = telefono.replace(/[\s\-\(\)]/g, '');

        if (telLimpio.startsWith('09') || telLimpio.startsWith('+5939') || telLimpio.startsWith('5939')) {
            txtContacto.textContent = "WhatsApp";
            elemContacto.onclick = () => {
                if (telLimpio.startsWith('09')) telLimpio = '593' + telLimpio.substring(1);
                else if (telLimpio.startsWith('+')) telLimpio = telLimpio.substring(1);
                window.open(`https://wa.me/${telLimpio}`, '_blank');
            };
        } else {
            txtContacto.textContent = "Llamar";
            elemContacto.onclick = () => {
                window.open(`tel:${telLimpio}`, '_self');
            };
        }
    }

    // Corrección URL de Google Maps Universal
    const btnNavegar = document.getElementById('btn-navegar');
    btnNavegar.onclick = () => {
        const latOrigen = parseFloat(ubicacionActiva[0]);
        const lngOrigen = parseFloat(ubicacionActiva[1]);
        const latDestino = parseFloat(farmacia.lat);
        const lngDestino = parseFloat(farmacia.lon);

        const urlGoogleMaps = `https://www.google.com/maps/dir/?api=1&origin=${latOrigen},${lngOrigen}&destination=${latDestino},${lngDestino}`;
        window.open(urlGoogleMaps, '_blank');
    };

    bottomSheet.classList.add('activo');
}

// ==========================================
// CONSULTA A LA API
// ==========================================
async function fetchFarmacias(radio = 2000, forzarOverpass = false) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.innerHTML = `<div class="loading-ring"></div><div class="loading-text"><h2>Ubicando farmacias...</h2><p>Escaneando radio de ${radio / 1000}km.</p></div>`;
        overlay.classList.remove('oculto');
    }

    markersGroup.clearLayers();
    let farmacias = [];
    let usóCache = false;

    if (!forzarOverpass) {
        const cache = localStorage.getItem('farmacias_tumbaco_cache');
        if (cache) {
            try {
                farmacias = JSON.parse(cache);
                usóCache = true;
            } catch (e) {
                console.error("Fallo caché", e);
            }
        }
    }

    if (usóCache && farmacias.length > 0) {
        if (overlay) overlay.classList.add('oculto');
        estaBuscando = false;
    } else {
        if (!navigator.onLine) {
            if (overlay) overlay.classList.add('oculto');
            mostrarAviso("Sin conexión a internet.");
            estaBuscando = false;
            return;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const lat = parseFloat(ubicacionActiva[0]);
            const lng = parseFloat(ubicacionActiva[1]);

            const query = `[out:json][timeout:10];node["amenity"="pharmacy"](around:${radio},${lat},${lng});out qt;`;
            const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`Status: ${response.status}`);

            const data = await response.json();
            farmacias = data.elements || [];

            if (farmacias.length > 0) {
                localStorage.setItem('farmacias_tumbaco_cache', JSON.stringify(farmacias));
            }
        } catch (error) {
            mostrarAviso("Error de red o timeout. Reintente la búsqueda.");
        } finally {
            if (overlay) overlay.classList.add('oculto');
            estaBuscando = false;
        }
    }

    if (farmacias.length === 0 && navigator.onLine) {
        mostrarAviso("Área sin resultados disponibles.");
        const btn5km = document.getElementById('btn-expandir-5km');
        if (btn5km) btn5km.classList.remove('oculto');
        return;
    }

    farmacias.forEach(f => {
        const m = L.marker([f.lat, f.lon], { icon: iconoFarmacia }).addTo(markersGroup);
        m.on('click', () => {
            document.querySelectorAll('.pin-medico').forEach(p => p.classList.remove('pin-activo'));
            if (m.getElement()) {
                const pin = m.getElement().querySelector('.pin-medico');
                if (pin) pin.classList.add('pin-activo');
            }
            mostrarBottomSheet(f);
        });
    });
}

// ==========================================
// GESTIÓN DE EVENTOS Y DETECTOR DE RED
// ==========================================
function iniciarMapa() {
    // Esta función garantiza que el modal solo desaparezca cuando se tiene una respuesta
    document.getElementById('modal-gps').style.display = 'none';
    map.setView(ubicacionActiva, 15);
    if (userMarker) map.removeLayer(userMarker);
    userMarker = L.marker(ubicacionActiva, { icon: iconoUsuario, interactive: false, zIndexOffset: -100 }).addTo(map);
    fetchFarmacias();
}

window.addEventListener('load', () => {
    if (!btnGPS) return;

    btnGPS.classList.remove('skeleton');

    // CORRECCIÓN CRÍTICA: Desbloquear el botón si hay internet
    if (!navigator.onLine) {
        btnGPS.disabled = true;
        btnGPS.textContent = "Sin conexión a internet";
    } else {
        btnGPS.disabled = false; // <-- ESTA ES LA LÍNEA QUE FALTABA
        btnGPS.textContent = "Activar GPS";
    }

    // (A partir de aquí sigue el código que ya tienes)
    window.addEventListener('offline', () => {
        if (btnGPS) {
            btnGPS.disabled = true;
            btnGPS.textContent = "Sin conexión a internet";
        }
    });

    window.addEventListener('online', () => {
        if (btnGPS) {
            btnGPS.disabled = false;
            btnGPS.textContent = "Activar GPS";
        }
    });

    btnGPS.onclick = () => {
        if (estaBuscando) return;
        estaBuscando = true;

        btnGPS.textContent = "Solicitando permiso...";
        btnGPS.disabled = true;

        if (!navigator.geolocation) {
            mostrarAviso("Tu navegador no soporta GPS. Usando Tumbaco.");
            ubicacionActiva = [...centroTumbaco];
            iniciarMapa();
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = parseFloat(position.coords.latitude);
                const lng = parseFloat(position.coords.longitude);
                ubicacionActiva = [lat, lng];

                if (calcularDistancia(lat, lng, centroTumbaco[0], centroTumbaco[1]) > 5) {
                    mostrarAviso("Estás fuera de Tumbaco. Simulando ubicación en el centro.");
                    ubicacionActiva = [...centroTumbaco];
                }

                iniciarMapa(); // Se llama estrictamente después de calcular coordenadas
            },
            () => {
                mostrarAviso("Permiso de ubicación denegado. Usando centro de Tumbaco.");
                ubicacionActiva = [...centroTumbaco];

                iniciarMapa(); // Se llama estrictamente tras la denegación
            },
            { enableHighAccuracy: true } // Se elimina timeout para evitar saltos prematuros
        );
    };

    const btnExpandir = document.getElementById('btn-expandir-5km');
    if (btnExpandir) {
        btnExpandir.onclick = () => {
            btnExpandir.classList.add('oculto');
            const overlay = document.getElementById('loading-overlay');
            if (overlay) overlay.classList.remove('oculto');
            fetchFarmacias(5000, true);
        };
    }

    const btnRecenter = document.getElementById('btn-recenter');
    if (btnRecenter) {
        btnRecenter.onclick = () => map.setView(ubicacionActiva, 15);
    }

    const btnCerrarBs = document.getElementById('btn-cerrar-bs');
    if (btnCerrarBs) {
        btnCerrarBs.onclick = () => {
            bottomSheet.classList.remove('activo');
            document.querySelectorAll('.pin-medico').forEach(p => p.classList.remove('pin-activo'));
        };
    }
});