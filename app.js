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


// Función para mostrar el Bottom Sheet con datos dinámicos
function mostrarBottomSheet(farmacia) {
    const sheet = document.getElementById('bottom-sheet');
    const tags = farmacia.tags;

    // 1. Inyectar Nombre y Distancia (H2 y H6)
    document.getElementById('bs-nombre').textContent = tags.name || "Farmacia sin nombre";

    // Calculamos distancia real usando map.distance (Leaflet)
    const latlngUsuario = L.latLng(ubicacionActiva[0], ubicacionActiva[1]);
    const latlngFarmacia = L.latLng(farmacia.lat, farmacia.lon);
    const distanciaCalculada = Math.round(map.distance(latlngUsuario, latlngFarmacia));
    document.getElementById('bs-distancia').textContent = "Distancia radial: Aprox. " + distanciaCalculada + " m";

    // 2. Lógica de Estado Abierto/Cerrado
    const estadoElemento = document.getElementById('bs-estado');
    if (tags.opening_hours === "24/7") {
        estadoElemento.textContent = "Abierto 24h";
        estadoElemento.style.color = "var(--color-verde-whatsapp)";
    } else {
        estadoElemento.textContent = "Horario: " + (tags.opening_hours || "No disponible");
    }

    // 3. ALGORITMO DE CONTACTO ADAPTATIVO (H5)
    const btnContacto = document.getElementById('btn-contacto');
    const textContacto = document.getElementById('text-contacto');
    const iconContainer = document.getElementById('icon-container');
    const telefonoRaw = tags.phone || tags['contact:phone'] || "";
    const telefonoLimpio = telefonoRaw.replace(/\D/g, ''); // Limpieza Regex

    const whatsappSVG = `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.445 0 .081 5.363.079 11.969c0 2.112.553 4.177 1.602 6.005L0 24l6.163-1.617a11.83 11.83 0 005.883 1.553h.005c6.602 0 11.967-5.367 11.97-11.97a11.85 11.85 0 00-3.484-8.452"/></svg>`;
    const phoneSVG = `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>`;

    const esCelular = telefonoLimpio.startsWith('09') || telefonoLimpio.startsWith('5939');

    if (!telefonoLimpio) {
        // H5: Prevención de errores si no hay teléfono
        btnContacto.style.display = 'none';
    } else {
        btnContacto.style.display = ''; // Revertir a default (flex/block)

        if (esCelular) {
            // Es celular -> WhatsApp
            btnContacto.innerHTML = `${whatsappSVG}<span>Enviar mensaje por WhatsApp</span>`;
            btnContacto.setAttribute("aria-label", "Enviar mensaje por WhatsApp");
            btnContacto.style.backgroundColor = "var(--color-verde-whatsapp)";
            btnContacto.onclick = () => window.open(`https://wa.me/${telefonoLimpio}`, '_blank');
        } else {
            // Es fijo -> Llamada tradicional
            btnContacto.innerHTML = `${phoneSVG}<span>Llamar a farmacia</span>`;
            btnContacto.setAttribute("aria-label", "Llamar a farmacia");
            btnContacto.style.backgroundColor = "var(--color-gris-oscuro)";
            btnContacto.onclick = () => window.location.href = `tel:${telefonoLimpio}`;
        }
    }

    // 4. Botón "Ir Ahora" (Navegación Delegada)
    document.getElementById('btn-navegar').onclick = () => {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${farmacia.lat},${farmacia.lon}`, '_blank');
    };

    // 5. Mostrar la tarjeta con animación
    sheet.classList.add('activo');
}



// Función Asíncrona (ES6+) para consumir datos blindada contra latencia
async function fetchFarmacias(radio = 2000, forzarOverpass = false) {
    let huboError = false;
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('oculto');

    // Limpiar marcadores
    if (typeof markersGroup !== 'undefined') markersGroup.clearLayers();

    let farmacias = [];
    let usóCache = false;

    // Paso A: Caché
    if (!forzarOverpass) {
        const cacheData = localStorage.getItem('farmacias_tumbaco_cache');
        if (cacheData) {
            try {
                farmacias = JSON.parse(cacheData);
                usóCache = true;
            } catch (e) {
                console.warn("Caché corrupto, recargando...");
            }
        }
    }

    if (usóCache) {
        if (overlay && !huboError) overlay.classList.add('oculto');
    } else {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 segundos max

        try {
            // SALVAVIDAS CRÍTICO: Evita enviar variables 'undefined' que rompen la API
            const lat = (typeof ubicacionActiva !== 'undefined' && ubicacionActiva[0]) ? ubicacionActiva[0] : -0.2135;
            const lng = (typeof ubicacionActiva !== 'undefined' && ubicacionActiva[1]) ? ubicacionActiva[1] : -78.4025;

            // Query optimizada con timeout interno de 5s
            const query = `[out:json][timeout:5];node["amenity"="pharmacy"](around:${radio},${lat},${lng});out qt;`;

            // SOLUCIÓN DE RED: Usamos el espejo de alta velocidad (lz4) y método POST
            const response = await fetch('https://lz4.overpass-api.de/api/interpreter', {
                method: 'POST',
                body: "data=" + encodeURIComponent(query),
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) throw new Error('Servidor Overpass rechazó la conexión');

            const data = await response.json();
            farmacias = data.elements || [];

            if (farmacias.length > 0) {
                localStorage.setItem('farmacias_tumbaco_cache', JSON.stringify(farmacias));
            }

        } catch (error) {
            console.error("Fallo crítico de red:", error);
            huboError = true;
            if (overlay) {
                // UI de Error intacta
                overlay.innerHTML = `
                    <div class="loading-text" style="text-align: center; color: white;">
                        <h2 style="color: #ff4d4d; margin-bottom: 10px;">Error de Conexión</h2>
                        <p style="margin-bottom: 20px;">No fue posible conectar con el servidor de mapas. Revisa tu conexión a internet.</p>
                        <button id="btn-reintentar" class="btn-primary" style="background-color: #dc3545; padding: 10px 20px; border: none; border-radius: 8px; color: white; cursor: pointer;">Reintentar</button>
                    </div>
                `;

                // Reintento sin recargar la página
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

    // 3. Activar GPS y Tracker (Evita clics perdidos)
    btnGPS.onclick = () => {
        if (estaBuscando) return;

        estaBuscando = true;
        btnGPS.disabled = true; // Desactivamos el botón visualmente

        // a) Feedback INMEDIATO
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.classList.remove('oculto');

        // b) Ocultar modal GPS directamente sin transición que lo atranque
        const modal = document.getElementById('modal-gps');
        if (modal) modal.style.display = 'none';

        // c) Disparar geolocalización
        watchId = navigator.geolocation.watchPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                if (estaBuscando) {
                    estaBuscando = false;

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

                    // Llama a api
                    fetchFarmacias();
                } else {
                    if (userMarker) {
                        userMarker.setLatLng([lat, lng]);
                    }
                }
            },
            (error) => {
                if (!estaBuscando) return;
                estaBuscando = false;

                alert("Permiso de ubicación denegado. Mostrando el centro de Tumbaco por defecto.");
                map.setView([-0.2135, -78.4025], 15);
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