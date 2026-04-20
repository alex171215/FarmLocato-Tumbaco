document.addEventListener('DOMContentLoaded', () => {
    // 1. REFERENCIAS AL DOM (Seguras)
    const bottomSheet = document.getElementById('bottom-sheet');
    const btnGPS = document.getElementById('btn-activar-gps');
    const aviso = document.getElementById('aviso-ubicacion');
    const txtAviso = document.getElementById('txt-aviso');

    // 2. CONFIGURACIÓN DEL MAPA
    const centroTumbaco = [-0.2135, -78.4025];
    let ubicacionActiva = centroTumbaco;
    let userMarker = null;
    let estaBuscando = false;

    const limitesTumbaco = L.latLngBounds(L.latLng(-0.2500, -78.4500), L.latLng(-0.1800, -78.3500));

    const map = L.map('map', {
        center: centroTumbaco,
        zoom: 15,
        minZoom: 15,
        maxZoom: 18,
        maxBounds: limitesTumbaco,
        maxBoundsViscosity: 1.0,
        zoomControl: false,
        tap: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);

    // ÍCONOS
    const iconoFarmacia = L.divIcon({ className: 'pin-wrapper', html: '<div class="pin-medico"></div>', iconSize: [48, 48], iconAnchor: [24, 24] });
    const iconoUsuario = L.divIcon({ className: 'user-marker', html: `<div class="user-pulse"></div><div class="user-dot"></div>`, iconSize: [32, 32], iconAnchor: [16, 16] });

    // ─── UTILIDAD DE CIERRE CENTRALIZADA ───────────────────────────────────────
    // BUG 5 FIX: Toda lógica de cierre pasa por aquí para garantizar que
    // aria-hidden="true" siempre se aplique al cerrar, en los 3 puntos de escape.
    function cerrarBottomSheet() {
        if (!bottomSheet) return;
        bottomSheet.classList.remove('activo');
        bottomSheet.setAttribute('aria-hidden', 'true'); // ← BUG 5 FIX
        document.querySelectorAll('.pin-medico').forEach(p => p.classList.remove('pin-activo'));
    }

    // CIERRE DE BOTTOM SHEET (Clic en mapa)
    map.on('click', cerrarBottomSheet);

    // CIERRE DE BOTTOM SHEET (Deslizamiento / Swipe hacia abajo)
    let startY = 0;
    if (bottomSheet) {
        bottomSheet.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, { passive: true });
        bottomSheet.addEventListener('touchmove', (e) => {
            e.stopPropagation();
            if (e.touches[0].clientY - startY > 40) {
                cerrarBottomSheet(); // ← Usa la utilidad centralizada
            }
        }, { passive: false });
    }

    // UTILIDADES
    function mostrarAviso(mensaje) {
        if (aviso && txtAviso) {
            txtAviso.textContent = mensaje;
            aviso.classList.remove('oculto');
            setTimeout(() => aviso.classList.add('oculto'), 7000);
        }
    }

    function calcularDistancia(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // ─── SVG ÍCONOS (BUG 4 FIX) ────────────────────────────────────────────────
    // Definidos como constantes para no repetir el markup en cada llamada.
    const SVG_WHATSAPP = `
        <svg class="icon-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.523 5.845L.057 23.428l5.752-1.506A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.694-.497-5.241-1.369l-.373-.221-3.415.895.91-3.326-.243-.387A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
        </svg>`;

    const SVG_TELEFONO = `
        <svg class="icon-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
        </svg>`;

    // ─── RENDER BOTTOM SHEET ────────────────────────────────────────────────────
    function mostrarBottomSheet(farmacia) {
        if (!bottomSheet) return;
        const tags = farmacia.tags || {};
        document.getElementById('bs-nombre').textContent = tags.name || "Farmacia sin nombre";

        const latlngUsuario = L.latLng(ubicacionActiva[0], ubicacionActiva[1]);
        const latlngFarmacia = L.latLng(farmacia.lat, farmacia.lon);
        document.getElementById('bs-distancia').textContent = "Distancia radial: Aprox. " + Math.round(map.distance(latlngUsuario, latlngFarmacia)) + " m";

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

        // ── ALGORITMO DE CONTACTO ADAPTATIVO (BUG 4 FIX) ──────────────────────
        const elemContacto = document.getElementById('btn-contacto');
        const txtContacto = document.getElementById('text-contacto');
        const iconContainer = document.getElementById('icon-container'); // ← Nueva referencia
        let telefono = tags.phone || tags['contact:phone'] || tags['contact:mobile'] || "";

        if (!telefono) {
            // Sin teléfono: ocultar botón completo (Heurística 5 — Prevención de errores)
            elemContacto.style.display = 'none';
        } else {
            elemContacto.style.display = 'flex';
            let telLimpio = telefono.replace(/[\s\-\(\)]/g, '');

            if (telLimpio.startsWith('09') || telLimpio.startsWith('+5939') || telLimpio.startsWith('5939')) {
                // Rama WhatsApp: botón verde + ícono de WhatsApp
                txtContacto.textContent = "WhatsApp";
                iconContainer.innerHTML = SVG_WHATSAPP;         // ← BUG 4 FIX
                elemContacto.style.backgroundColor = "var(--color-verde-whatsapp)";
                elemContacto.style.color = "white";
                elemContacto.setAttribute('aria-label', 'Contactar por WhatsApp');
                elemContacto.onclick = () => window.open(
                    `https://wa.me/${telLimpio.startsWith('09') ? '593' + telLimpio.substring(1) : telLimpio.replace('+', '')}`,
                    '_blank'
                );
            } else {
                // Rama llamada: botón gris + ícono de teléfono
                txtContacto.textContent = "Llamar";
                iconContainer.innerHTML = SVG_TELEFONO;         // ← BUG 4 FIX
                elemContacto.style.backgroundColor = "#757575";
                elemContacto.style.color = "white";
                elemContacto.setAttribute('aria-label', 'Llamar por teléfono');
                elemContacto.onclick = () => window.open(`tel:${telLimpio}`, '_self');
            }
        }

        const btnNavegar = document.getElementById('btn-navegar');
        btnNavegar.onclick = () => {
            const latOrigen = parseFloat(ubicacionActiva[0]);
            const lngOrigen = parseFloat(ubicacionActiva[1]);
            const latDestino = parseFloat(farmacia.lat);
            const lngDestino = parseFloat(farmacia.lon);
            const urlMap = `https://www.google.com/maps/dir/?api=1&origin=${latOrigen},${lngOrigen}&destination=${latDestino},${lngDestino}`;
            window.open(urlMap, '_blank');
        };

        // BUG 5 FIX: Quitar aria-hidden ANTES de mostrar, para que los screen
        // readers anuncien el diálogo correctamente en el momento que aparece.
        bottomSheet.removeAttribute('aria-hidden');
        bottomSheet.classList.add('activo');
    }

    // ─── FETCH API (Overpass) ───────────────────────────────────────────────────
    async function fetchFarmacias(radio = 2000, forzarOverpass = false) {
        let huboError = false;

        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.innerHTML = `<div class="loading-ring" aria-hidden="true"></div><div class="loading-text"><h2>Ubicando farmacias...</h2><p>Escaneando radio de ${radio / 1000}km. Por favor, espere.</p></div>`;
            overlay.classList.remove('oculto');
        }

        markersGroup.clearLayers();
        let farmacias = [];
        let usoCache = false;

        if (!forzarOverpass) {
            const cache = localStorage.getItem('farmacias_tumbaco_cache');
            if (cache) { try { farmacias = JSON.parse(cache); usoCache = true; } catch (e) { /* Caché corrupta, ignorar */ } }
        }

        if (usoCache && farmacias.length > 0) {
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
                const query = `[out:json][timeout:10];node["amenity"="pharmacy"](around:${radio},${parseFloat(ubicacionActiva[0])},${parseFloat(ubicacionActiva[1])});out qt;`;
                const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (!response.ok) throw new Error("Error API: " + response.status);
                farmacias = (await response.json()).elements || [];
                if (farmacias.length > 0) localStorage.setItem('farmacias_tumbaco_cache', JSON.stringify(farmacias));
            } catch (error) {
                huboError = true;

                if (overlay) {
                    overlay.innerHTML = `
                        <div class="loading-text" style="text-align: center; color: var(--color-superficie);">
                            <h2 style="color: var(--color-rojo-trafico); font-size: 1.2rem; margin-bottom: 10px;">Error de Conexión</h2>
                            <p style="margin-bottom: 15px;">No fue posible conectar con el servidor de mapas.</p>
                            <button id="btn-reintentar-api" style="background-color: var(--color-azul-rey); color: white; padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; min-height: 44px;">Reintentar</button>
                        </div>
                    `;
                    overlay.classList.remove('oculto');
                    document.getElementById('btn-reintentar-api').onclick = () => fetchFarmacias(radio, forzarOverpass);
                }
            } finally {
                if (overlay && !huboError) overlay.classList.add('oculto');
                estaBuscando = false;
            }
        }

        if (!huboError) {
            if (farmacias.length === 0 && navigator.onLine) {
                mostrarAviso("No hay resultados a 2km. Toca el botón inferior para buscar a 5km.");
                const btn5km = document.getElementById('btn-expandir-5km');
                if (btn5km) btn5km.classList.remove('oculto');
            } else {
                farmacias.forEach(f => {
                    const m = L.marker([f.lat, f.lon], { icon: iconoFarmacia, keyboard: true }).addTo(markersGroup);

                    const markerElement = m.getElement();
                    if (markerElement) {
                        markerElement.setAttribute('tabindex', '0');
                        markerElement.setAttribute('role', 'button');
                        markerElement.setAttribute('aria-label', `Farmacia: ${f.tags?.name || 'Sin nombre'}`);

                        markerElement.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                m.fire('click');
                            }
                        });
                    }

                    m.on('click', () => {
                        document.querySelectorAll('.pin-medico').forEach(p => p.classList.remove('pin-activo'));
                        if (m.getElement()) m.getElement().querySelector('.pin-medico').classList.add('pin-activo');
                        mostrarBottomSheet(f);

                        const btnCerrar = document.getElementById('btn-cerrar-bs');
                        if (btnCerrar) btnCerrar.focus();
                    });
                });
            }
        }
    }

    function iniciarMapa() {
        const modal = document.getElementById('modal-gps');
        if (modal) modal.style.display = 'none';
        map.setView(ubicacionActiva, 15);
        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.marker(ubicacionActiva, { icon: iconoUsuario, interactive: false, zIndexOffset: -100 }).addTo(map);
        fetchFarmacias();
    }

    // ─── INICIALIZACIÓN PRINCIPAL DEL BOTÓN GPS ─────────────────────────────────
    if (btnGPS) {
        btnGPS.classList.remove('skeleton');

        if (!navigator.onLine) {
            btnGPS.disabled = true;
            btnGPS.textContent = "Sin conexión a internet";
        } else {
            btnGPS.disabled = false;
            btnGPS.textContent = "Activar GPS";
        }

        btnGPS.onclick = () => {
            if (estaBuscando) return;
            estaBuscando = true;

            btnGPS.textContent = "Solicitando permiso...";
            btnGPS.disabled = true;

            if (!navigator.geolocation) {
                mostrarAviso("Navegador sin GPS. Usando Tumbaco.");
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
                        mostrarAviso("Fuera de zona. Usando Tumbaco.");
                        ubicacionActiva = [...centroTumbaco];
                    }
                    iniciarMapa();
                },
                () => {
                    mostrarAviso("Permiso denegado. Usando centro de Tumbaco.");
                    ubicacionActiva = [...centroTumbaco];
                    iniciarMapa();
                },
                { enableHighAccuracy: true }
            );
        };
    }

    // ─── EVENTOS SECUNDARIOS ────────────────────────────────────────────────────
    window.addEventListener('offline', () => {
        if (btnGPS) { btnGPS.disabled = true; btnGPS.textContent = "Sin conexión a internet"; }
        mostrarAviso("Se perdió la conexión. Revisa tu Wi-Fi o datos móviles para continuar.");
    });
    window.addEventListener('online', () => {
        if (btnGPS) { btnGPS.disabled = false; btnGPS.textContent = "Activar GPS"; }
    });

    const btnExpandir = document.getElementById('btn-expandir-5km');
    if (btnExpandir) btnExpandir.onclick = () => { btnExpandir.classList.add('oculto'); fetchFarmacias(5000, true); };

    const btnRecenter = document.getElementById('btn-recenter');
    if (btnRecenter) btnRecenter.onclick = () => map.setView(ubicacionActiva, 15);

    // BUG 5 FIX: El botón X también usa la utilidad centralizada de cierre
    const btnCerrarBs = document.getElementById('btn-cerrar-bs');
    if (btnCerrarBs) btnCerrarBs.onclick = cerrarBottomSheet;
});