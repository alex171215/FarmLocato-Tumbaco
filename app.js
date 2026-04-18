const bottomSheet = document.getElementById('bottom-sheet');

// Los eventos de UI (cerrar, touchstart, etc) se movieron al DOMContentLoaded al final del archivo para garantizar el DOM listo

// 1. Coordenadas exactas para el área de Tumbaco (Bounding Box)
const surOeste = L.latLng(-0.2500, -78.4500);
const norEste = L.latLng(-0.1800, -78.3500);
const limitesTumbaco = L.latLngBounds(surOeste, norEste);

// 2. Configuración del Mapa ("Pared de Ladrillo")
const map = L.map('map', {
    center: [-0.2135, -78.4025], // Centro exacto de Tumbaco
    zoom: 15,                    // Zoom inicial lo suficientemente cerca
    minZoom: 15,                 // LA CLAVE: Prohíbe alejar la cámara. Mata los bordes grises.
    maxZoom: 18,                 // Límite de acercamiento
    maxBounds: limitesTumbaco,   // Encierra la cámara en este rectángulo
    maxBoundsViscosity: 1.0,     // Rebote sólido al 100%. No deja arrastrar hacia afuera.
    zoomControl: false,          // Minimalismo (sin botones de +/-)
    tap: false                   // Reparación IHC: Elimina el retraso de toque en móviles
});

// 3. Capa base de OpenStreetMap (en escala de grises vía CSS)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
}).addTo(map);

console.log("Mapa bloqueado estrictamente en Tumbaco. Cero bordes grises.");

// ==========================================
// FASE 2: MOTOR GEOESPACIAL Y DATOS (ASYNC)
// ==========================================

// Creación del ícono personalizado de Leaflet usando nuestra clase CSS
const iconoFarmacia = L.divIcon({
    className: 'pin-wrapper', // Clase del contenedor
    html: '<div class="pin-medico"></div>',
    iconSize: [48, 48], // Ley de Fitts: 48px equivalentes a 3rem
    iconAnchor: [24, 24]
});

// ==========================================
// MARCADOR DE UBICACIÓN DEL USUARIO
// ==========================================
const iconoUsuario = L.divIcon({
    className: 'user-marker',
    html: `
        <div class="user-pulse"></div>
        <div class="user-dot"></div>
    `,
    iconSize: [32, 32], // Equivalente a 2rem para asegurar alineación visual
    iconAnchor: [16, 16]
});

// ==========================================
// LÓGICA DE GEOLOCALIZACIÓN Y GEOCERCADO
// ==========================================
const centroTumbaco = [-0.2135, -78.4025];
let ubicacionActiva = centroTumbaco; // Fallback
let userMarker = null;
let markersGroup = L.layerGroup().addTo(map); // Grupo de capas para los pines de farmacias

// H3: Fórmula del semi-verseno (Haversine) para cálculo de distancias
function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Variable "Candado" (Evita ejecuciones duplicadas)
let estaBuscando = false;
let watchId = null; // Guardar el watch ID para rastreo en tiempo real

const btnGPS = document.getElementById('btn-activar-gps');

// Se han movido y encapsulado btnGPS.onclick y el evento de recentrar dentro del bloque DOMContentLoaded al final de app.js


// Función para poblar y mostrar la tarjeta de información (Bottom Sheet)
function mostrarBottomSheet(farmacia) {
    const bottomSheet = document.getElementById('bottom-sheet');
    const tags = farmacia.tags || {};

    // 1. Inyectar Nombre y Distancia
    document.getElementById('bs-nombre').textContent = tags.name || "Farmacia sin nombre";

    const latlngUsuario = L.latLng(ubicacionActiva[0], ubicacionActiva[1]);
    const latlngFarmacia = L.latLng(farmacia.lat, farmacia.lon);
    const distanciaCalculada = Math.round(map.distance(latlngUsuario, latlngFarmacia));
    document.getElementById('bs-distancia').textContent = "Distancia radial: Aprox. " + distanciaCalculada + " m";

    // 2. Renderizado Condicional del Horario (Heurística 8)
    const contenedorHorario = document.getElementById('contenedor-horario');
    const elemEstado = document.getElementById('bs-estado');
    const elemHorario = document.getElementById('bs-horario');

    if (tags.opening_hours) {
        contenedorHorario.style.display = 'block'; // Mostramos todo el bloque

        if (tags.opening_hours === "24/7") {
            elemEstado.textContent = "Abierto 24h";
            elemEstado.style.color = "var(--color-verde-whatsapp)";
            elemHorario.style.display = 'none'; // Ocultamos el string "24/7" redundante
        } else {
            elemEstado.textContent = "";
            elemHorario.style.display = 'block';
            elemHorario.textContent = "Horario: " + tags.opening_hours;
        }
    } else {
        // Si no hay dato, ocultamos estado, horario y microcopy de un solo golpe
        contenedorHorario.style.display = 'none';
    }

    // 3. Renderizado del Contacto (Celular vs Fijo)
    const elemContacto = document.getElementById('btn-contacto');
    const txtContacto = document.getElementById('text-contacto');
    let telefono = tags.phone || tags['contact:phone'] || tags['contact:mobile'] || "";

    if (telefono) {
        elemContacto.style.display = 'flex';
        // Limpiamos el número de espacios o caracteres raros
        let telLimpio = telefono.replace(/[\s\-\(\)]/g, '');

        // Algoritmo para detectar si es celular (empieza con 09 o +5939) en Ecuador
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
        // Si no hay teléfono, ocultamos el botón de contacto para prevenir errores (Heurística 5)
        elemContacto.style.display = 'none';
    }

    // 4. Corrección de Enrutamiento Estricto (Google Maps)
    const btnNavegar = document.getElementById('btn-navegar');
    btnNavegar.onclick = () => {
        const latOrigen = ubicacionActiva[0];
        const lngOrigen = ubicacionActiva[1];
        const latDestino = farmacia.lat;
        const lngDestino = farmacia.lon;

        // URL estructurada con origen y destino explícitos
        const urlGoogleMaps = `https://www.google.com/maps/dir/?api=1&origin=${latOrigen},${lngOrigen}&destination=${latDestino},${lngDestino}&travelmode=walking`;
        window.open(urlGoogleMaps, '_blank');
    };

    // 5. Mostrar la tarjeta animada
    bottomSheet.classList.add('activo');
}



// Función Asíncrona (ES6+) para consumir datos - VERSIÓN ESTABLE GITHUB PAGES
async function fetchFarmacias(radio = 2000, forzarOverpass = false) {
    let huboError = false;
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('oculto');

    if (typeof markersGroup !== 'undefined') markersGroup.clearLayers();

    let farmacias = [];
    let usóCache = false;

    if (!forzarOverpass) {
        const cacheData = localStorage.getItem('farmacias_tumbaco_cache');
        if (cacheData) {
            try {
                farmacias = JSON.parse(cacheData);
                usóCache = true;
            } catch (e) { }
        }
    }

    if (usóCache) {
        if (overlay && !huboError) overlay.classList.add('oculto');
    } else {
        // AUMENTADO A 15 SEGUNDOS PARA REDES MÓVILES
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
            const lat = (typeof ubicacionActiva !== 'undefined' && ubicacionActiva[0]) ? ubicacionActiva[0] : -0.2135;
            const lng = (typeof ubicacionActiva !== 'undefined' && ubicacionActiva[1]) ? ubicacionActiva[1] : -78.4025;

            // MÉTODO GET ESTÁNDAR (100% compatible con GitHub Pages y celulares)
            const query = `[out:json][timeout:10];node["amenity"="pharmacy"](around:${radio},${lat},${lng});out qt;`;
            const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error('Error de servidor');

            const data = await response.json();
            farmacias = data.elements || [];

            if (farmacias.length > 0) {
                localStorage.setItem('farmacias_tumbaco_cache', JSON.stringify(farmacias));
            }

        } catch (error) {
            console.error("Fallo crítico de red:", error);
            huboError = true;
            if (overlay) {
                overlay.innerHTML = `
                    <div class="loading-text" style="text-align: center; color: white;">
                        <h2 style="color: #ff4d4d; margin-bottom: 10px;">Error de Conexión</h2>
                        <p style="margin-bottom: 20px;">No fue posible conectar con el servidor de mapas. Revisa tu conexión a internet.</p>
                        <button id="btn-reintentar" class="btn-primary" style="background-color: #dc3545; padding: 10px 20px; border: none; border-radius: 8px; color: white; cursor: pointer;">Reintentar</button>
                    </div>
                `;
                document.getElementById('btn-reintentar').onclick = () => {
                    overlay.innerHTML = `
                        <div class="loading-ring" aria-hidden="true"></div>
                        <div class="loading-text">
                            <h2>Ubicando farmacias...</h2>
                            <p>Escaneando radio de ${radio / 1000}km. Por favor, espere.</p>
                        </div>
                    `;
                    fetchFarmacias(radio, forzarOverpass);
                };
            }
            return;
        } finally {
            if (overlay && !huboError) {
                overlay.classList.add('oculto');
            }
        }
    }

    if (farmacias.length === 0 && !huboError) {
        alert(`No se encontraron farmacias a ${radio / 1000}km.`);
        const btn5km = document.getElementById('btn-expandir-5km');
        if (btn5km) btn5km.classList.remove('oculto');
        return;
    }

    farmacias.forEach(farmacia => {
        const lat = farmacia.lat;
        const lon = farmacia.lon;

        if (typeof markersGroup !== 'undefined') {
            const marker = L.marker([lat, lon], { icon: iconoFarmacia }).addTo(markersGroup);

            marker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                document.querySelectorAll('.pin-medico').forEach(pin => pin.classList.remove('pin-activo'));
                if (marker.getElement()) {
                    const pin = marker.getElement().querySelector('.pin-medico');
                    if (pin) pin.classList.add('pin-activo');
                }
                if (typeof mostrarBottomSheet === 'function') mostrarBottomSheet(farmacia);
                marker.setZIndexOffset(1000);
            });
        }
    });
}

// ==========================================
// ASIGNACIÓN CENTRALIZADA DE EVENTOS
// ==========================================
window.addEventListener('load', () => {

    // Resurrección de la Interfaz (Carga Protegida completa)
    btnGPS.removeAttribute('disabled');
    btnGPS.classList.remove('skeleton');

    // 3. Activar GPS y Tracker (Evita clics perdidos y soluciona Race Condition)
    btnGPS.onclick = () => {
        if (estaBuscando) return;
        estaBuscando = true;

        // 1. Feedback en el botón (Esperando que el usuario responda al navegador)
        const textoOriginal = btnGPS.textContent;
        btnGPS.textContent = "Solicitando permiso...";
        btnGPS.disabled = true;

        let primerLlamado = true; // Bandera para controlar el flujo inicial

        // 2. Disparar geolocalización (El navegador pausa aquí para mostrar su alerta nativa)
        watchId = navigator.geolocation.watchPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                if (primerLlamado) {
                    primerLlamado = false;

                    // 3. AHORA SÍ: El usuario dio "Permitir". Ocultamos modal.
                    const modal = document.getElementById('modal-gps');
                    if (modal) modal.style.display = 'none';

                    const distancia = calcularDistancia(lat, lng, centroTumbaco[0], centroTumbaco[1]);

                    if (distancia > 5) {
                        alert("Te encuentras fuera de la zona de cobertura. Mostrando el centro de Tumbaco por defecto.");
                        ubicacionActiva = centroTumbaco;
                        map.setView(centroTumbaco, 15);
                    } else {
                        ubicacionActiva = [lat, lng];
                        map.setView(ubicacionActiva, 15);
                    }

                    if (userMarker) map.removeLayer(userMarker);
                    userMarker = L.marker([lat, lng], { icon: iconoUsuario, interactive: false, zIndexOffset: -100 }).addTo(map);

                    // 4. Invocamos la búsqueda (fetchFarmacias mostrará el spinner)
                    fetchFarmacias();
                } else {
                    // Actualizaciones de radar en tiempo real
                    if (userMarker) userMarker.setLatLng([lat, lng]);
                }
            },
            (error) => {
                if (!primerLlamado) return;
                primerLlamado = false;
                estaBuscando = false;

                // 3B. ERROR o DENEGADO: Restauramos botón
                btnGPS.textContent = textoOriginal;
                btnGPS.disabled = false;

                alert("Permiso de ubicación denegado. Mostrando el centro de Tumbaco por defecto.");

                const modal = document.getElementById('modal-gps');
                if (modal) modal.style.display = 'none';

                ubicacionActiva = [-0.2135, -78.4025];
                map.setView(ubicacionActiva, 15);
                fetchFarmacias();
            },
            {
                maximumAge: 10000,
                timeout: 10000,
                enableHighAccuracy: true
            }
        );
    };

    // 1. H3: Detener propagación en el Bottom Sheet
    bottomSheet.addEventListener('touchstart', (e) => e.stopPropagation());
    bottomSheet.addEventListener('mousedown', (e) => e.stopPropagation());

    // 2. Botón de cerrar
    document.getElementById('btn-cerrar-bs').onclick = () => {
        bottomSheet.classList.remove('activo');
    };

    // 4. Botón Recentrar Mapa
    document.getElementById('btn-recenter').addEventListener('click', () => {
        map.setView(ubicacionActiva, 15);
    });

    // 5. Expandir búsqueda (H9: Recuperación de Errores)
    document.getElementById('btn-expandir-5km').addEventListener('click', () => {
        const btn = document.getElementById('btn-expandir-5km');
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            const overlayText = overlay.querySelector('p');
            overlayText.textContent = "Ampliando radio de búsqueda a 5km...";
            overlay.classList.remove('oculto');
        }

        // Limpiar la capa de pines de farmacias actual
        markersGroup.clearLayers();

        btn.classList.add('oculto');
        // Llamar a fetchFarmacias(5000) forzando la petición a Overpass (ignorando el caché de 2km)
        fetchFarmacias(5000, true);
    });

});