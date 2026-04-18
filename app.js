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

map.on('click', () => { bottomSheet.classList.remove('activo'); document.querySelectorAll('.pin-medico').forEach(p => p.classList.remove('pin-activo')); });

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

    // 4. Corrección de Enrutamiento (Google Maps Universal)
    const btnNavegar = document.getElementById('btn-navegar');
    btnNavegar.onclick = () => {
        // Enrutamiento OFICIAL y universal de Google Maps
        // Toma ubicacionActiva (que será Tumbaco si deniegas o estás en la PUCE) como 'origin'
        const latOrigen = ubicacionActiva[0];
        const lngOrigen = ubicacionActiva[1];
        const latDestino = farmacia.lat;
        const lngDestino = farmacia.lon;

        const urlGoogleMaps = `https://www.google.com/maps/dir/?api=1&origin=${latOrigen},${lngOrigen}&destination=${latDestino},${lngDestino}&travelmode=walking`;

        window.open(urlGoogleMaps, '_blank');
    };

    bottomSheet.classList.add('activo');
}

// ==========================================
// CONSULTA A LA API (Sin trampas, Fallo rápido, URL limpia)
// ==========================================
async function fetchFarmacias(radio = 2000, forzarOverpass = false) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.innerHTML = `<div class="loading-ring"></div><div class="loading-text"><h2>Ubicando farmacias...</h2><p>Escaneando radio de ${radio / 1000}km.</p></div>`;
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
            } catch (e) { }
        }
    }

    if (usóCache && farmacias.length > 0) {
        if (overlay) overlay.classList.add('oculto');
        estaBuscando = false;
    } else {
        // Validación de red antes de intentar
        if (!navigator.onLine) {
            if (overlay) overlay.classList.add('oculto');
            mostrarAviso("Sin conexión a internet. No se pueden descargar datos.");
            estaBuscando = false;
            return;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 segundos max

        try {
            // SINTAXIS EXACTA REQUERIDA
            const lat = ubicacionActiva[0];
            const lng = ubicacionActiva[1];
            const query = `[out:json][timeout:8];node["amenity"="pharmacy"](around:${radio},${lat},${lng});out qt;`;
            const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error('Error en el servidor');

            const data = await response.json();
            farmacias = data.elements || [];

            if (farmacias.length > 0) {
                localStorage.setItem('farmacias_tumbaco_cache', JSON.stringify(farmacias));
            }
        } catch (error) {
            // Cero trampas. Si falla, avisamos y salimos.
            console.error("Fallo de red:", error);
            mostrarAviso("Servidor no disponible. Por favor, reintenta más tarde.");
        } finally {
            if (overlay) overlay.classList.add('oculto');
            estaBuscando = false;
        }
    }

    if (farmacias.length === 0 && navigator.onLine) {
        mostrarAviso("No hay farmacias en este radio.");
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
// GESTIÓN DE EVENTOS Y DETECTOR DE RED OFFLINE
// ==========================================
window.addEventListener('load', () => {
    if (!btnGPS) return;

    // Quitar skeleton
    btnGPS.classList.remove('skeleton');

    // 1. EVALUACIÓN DE RED INICIAL (H5: Prevención de Errores)
    if (!navigator.onLine) {
        btnGPS.disabled = true;
        btnGPS.textContent = "Sin conexión a internet";
        mostrarAviso("Se requiere conexión a internet para iniciar la búsqueda.");
    } else {
        btnGPS.removeAttribute('disabled');
    }

    // 2. LISTENERS DE RED EN TIEMPO REAL
    window.addEventListener('offline', () => {
        mostrarAviso("Se ha perdido la conexión a internet.");
        if (btnGPS) {
            btnGPS.disabled = true;
            if (btnGPS.textContent === "Activar GPS") btnGPS.textContent = "Sin conexión a internet";
        }
    });

    window.addEventListener('online', () => {
        mostrarAviso("Conexión restaurada.");
        if (btnGPS) {
            btnGPS.disabled = false;
            if (btnGPS.textContent === "Sin conexión a internet") btnGPS.textContent = "Activar GPS";
        }
    });

    // 3. Lógica del botón de GPS (Corregido para PC - Sin Timeout)
    btnGPS.onclick = () => {
        if (estaBuscando) return;
        estaBuscando = true;

        btnGPS.textContent = "Solicitando permiso...";
        btnGPS.disabled = true;

        // Opciones SIN timeout para que espere al navegador de la PC el tiempo que sea necesario
        const opcionesGPS = { enableHighAccuracy: true, maximumAge: 0 };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                ubicacionActiva = [position.coords.latitude, position.coords.longitude];
                // Si está en la PUCE (>5km), lo forzamos a Tumbaco
                if (calcularDistancia(ubicacionActiva[0], ubicacionActiva[1], centroTumbaco[0], centroTumbaco[1]) > 5) {
                    mostrarAviso("Fuera de zona. Usando centro de Tumbaco.");
                    ubicacionActiva = centroTumbaco;
                }
                document.getElementById('modal-gps').style.display = 'none';
                map.setView(ubicacionActiva, 15);
                if (userMarker) map.removeLayer(userMarker);
                userMarker = L.marker(ubicacionActiva, { icon: iconoUsuario, interactive: false, zIndexOffset: -100 }).addTo(map);

                fetchFarmacias();
            },
            () => {
                mostrarAviso("Permiso denegado. Usando centro de Tumbaco.");
                ubicacionActiva = centroTumbaco; // Se asigna Tumbaco como origen
                document.getElementById('modal-gps').style.display = 'none';
                map.setView(ubicacionActiva, 15);

                fetchFarmacias();
            },
            opcionesGPS
        );
    };

    // Eventos secundarios
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