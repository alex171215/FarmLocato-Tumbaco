const bottomSheet = document.getElementById('bottom-sheet');

// 1. Coordenadas exactas para el área de Tumbaco (Bounding Box)
const surOeste = L.latLng(-0.2500, -78.4500);
const norEste = L.latLng(-0.1800, -78.3500);
const limitesTumbaco = L.latLngBounds(surOeste, norEste);

// 2. Configuración del Mapa ("Pared de Ladrillo")
const map = L.map('map', {
    center: [-0.2135, -78.4025], // Centro exacto de Tumbaco
    zoom: 15,                    // Zoom inicial lo suficientemente cerca
    minZoom: 15,                 // Prohíbe alejar la cámara. Mata los bordes grises.
    maxZoom: 18,                 // Límite de acercamiento
    maxBounds: limitesTumbaco,   // Encierra la cámara en este rectángulo
    maxBoundsViscosity: 1.0,     // Rebote sólido al 100%. No deja arrastrar hacia afuera.
    zoomControl: false,          // Minimalismo (sin botones de +/-)
    tap: false                   // Reparación IHC: Elimina el retraso de toque en móviles
});

// 3. Capa base de OpenStreetMap (en escala de grises vía CSS)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

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
    html: `
        <div class="user-pulse"></div>
        <div class="user-dot"></div>
    `,
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

    if (telefono) {
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
    } else {
        elemContacto.style.display = 'none';
    }

    const btnNavegar = document.getElementById('btn-navegar');
    btnNavegar.onclick = () => {
        const urlGoogleMaps = `https://www.google.com/maps/dir/?api=1&origin=$${ubicacionActiva[0]},${ubicacionActiva[1]}&destination=${farmacia.lat},${farmacia.lon}&travelmode=walking`;
        window.open(urlGoogleMaps, '_blank');
    };

    bottomSheet.classList.add('activo');
}

// ==========================================
// CONSULTA A LA API (Con Caché y Kumi Server)
// ==========================================
async function fetchFarmacias(radio = 2000, forzarOverpass = false) {
    let huboError = false;
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
            } catch (e) { }
        }
    }

    if (usóCache && farmacias.length > 0) {
        if (overlay) overlay.classList.add('oculto');
        estaBuscando = false;
    } else {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const query = `[out:json][timeout:10];node["amenity"="pharmacy"](around:${radio},${ubicacionActiva[0]},${ubicacionActiva[1]});out qt;`;
            const url = `https://overpass.kumi.systems/api/interpreter?data=${encodeURIComponent(query)}`;

            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error('Error en el servidor');

            const data = await response.json();
            farmacias = data.elements || [];

            if (farmacias.length > 0) {
                localStorage.setItem('farmacias_tumbaco_cache', JSON.stringify(farmacias));
            }
        } catch (error) {
            huboError = true;
            if (overlay) {
                overlay.innerHTML = `
                    <div class="loading-text" style="text-align: center; color: white;">
                        <h2 style="color: #ff4d4d;">Error de Conexión</h2>
                        <p>No se pudo conectar al servidor. Intenta de nuevo.</p>
                        <button id="btn-reintentar" class="btn-primary" style="background: var(--color-azul-rey); margin-top:15px; border:none; padding:10px 20px; border-radius:8px; color:white; cursor:pointer;">Reintentar</button>
                    </div>`;

                document.getElementById('btn-reintentar').onclick = () => {
                    fetchFarmacias(radio, forzarOverpass);
                };
            }
            estaBuscando = false;
            return;
        } finally {
            if (overlay && !huboError) overlay.classList.add('oculto');
            if (!huboError) estaBuscando = false;
        }
    }

    if (farmacias.length === 0 && !huboError) {
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
// ASIGNACIÓN DE EVENTOS AL CARGAR LA PÁGINA
// ==========================================
window.addEventListener('load', () => {
    if (!btnGPS) return;

    // Quitar skeleton cuando JS esté listo
    btnGPS.removeAttribute('disabled');
    btnGPS.classList.remove('skeleton');

    // Lógica del botón de GPS (Con pausa para el modal nativo)
    btnGPS.onclick = () => {
        if (estaBuscando) return;
        estaBuscando = true;

        btnGPS.textContent = "Solicitando permiso...";
        btnGPS.disabled = true;

        navigator.geolocation.getCurrentPosition(
            (position) => {
                ubicacionActiva = [position.coords.latitude, position.coords.longitude];
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
                ubicacionActiva = centroTumbaco;
                document.getElementById('modal-gps').style.display = 'none';
                map.setView(ubicacionActiva, 15);

                fetchFarmacias();
            },
            { enableHighAccuracy: true, timeout: 8000 }
        );
    };

    // Evento de botón expandir 5km
    const btnExpandir = document.getElementById('btn-expandir-5km');
    if (btnExpandir) {
        btnExpandir.onclick = () => {
            btnExpandir.classList.add('oculto');
            fetchFarmacias(5000, true);
        };
    }

    // Evento para centrar el mapa de nuevo
    const btnRecenter = document.getElementById('btn-recenter');
    if (btnRecenter) {
        btnRecenter.onclick = () => {
            map.setView(ubicacionActiva, 15);
        };
    }

    // Cerrar Bottom Sheet
    const btnCerrarBs = document.getElementById('btn-cerrar-bs');
    if (btnCerrarBs) {
        btnCerrarBs.onclick = () => {
            bottomSheet.classList.remove('activo');
            document.querySelectorAll('.pin-medico').forEach(p => p.classList.remove('pin-activo'));
        };
    }
});