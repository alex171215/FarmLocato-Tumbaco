document.addEventListener('DOMContentLoaded', () => {
    // 1. REFERENCIAS AL DOM (Seguras)
    const bottomSheet = document.getElementById('bottom-sheet');
    const btnGPS = document.getElementById('btn-activar-gps');
    const aviso = document.getElementById('aviso-ubicacion');
    const txtAviso = document.getElementById('txt-aviso');

    const CONTACTOS_MAESTROS = {
        'fybeca': {
            wa: '593968223333',
            tel: '1800392322'
        },
        'sana': {
            wa: null, // No tienen WA nacional unificado público confiable
            tel: '1700726272'
        },
        'pharmacy': { // Cubre "Pharmacy's"
            wa: '593981297551',
            tel: '043730793' // O el código corto *9000
        },
        'cruz azul': {
            wa: '593969872794',
            tel: '043730780' // Mismo número para ambos
        },
        'medicity': {
            wa: '593983605347',
            tel: '1800633424'
        },
        'economica': { // Farmacias Económicas
            wa: '593992043737',
            tel: '1800326666'
        },
        'ecuapharma': {
            wa: '593981292581',
            tel: '025154214' // Matriz Quito
        }
    };

    // 2. CONFIGURACIÓN DEL MAPA
    const centroTumbaco = [-0.2135, -78.4025];
    let ubicacionActiva = centroTumbaco;
    let userMarker = null;
    let estaBuscando = false;
    let mapaInicializado = false;

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
    function cerrarBottomSheet() {
        if (!bottomSheet) return;
        bottomSheet.classList.remove('activo');
        bottomSheet.setAttribute('aria-hidden', 'true');
        document.querySelectorAll('.pin-medico').forEach(p => p.classList.remove('pin-activo'));
    }

    map.on('click', cerrarBottomSheet);

    let startY = 0;
    if (bottomSheet) {
        bottomSheet.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, { passive: true });
        bottomSheet.addEventListener('touchmove', (e) => {
            e.stopPropagation();
            if (e.touches[0].clientY - startY > 40) {
                cerrarBottomSheet();
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

        // ── ALGORITMO DE CONTACTO DUAL ADAPTATIVO ──────────────────────
        const contenedorContactos = document.getElementById('contenedor-contactos');
        const btnWa = document.getElementById('btn-whatsapp');
        const btnTel = document.getElementById('btn-llamar');

        // Reset visual preventivo
        btnWa.style.display = 'none';
        btnTel.style.display = 'none';
        contenedorContactos.style.display = 'none';

        const nombreFarmacia = (tags.name || "").toLowerCase();
        // Normalización para evitar problemas con tildes (ej. Económicas)
        const nombreNorm = nombreFarmacia.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        let numWa = null;
        let numTel = null;

        // 1. Prioridad: Buscar en Contactos Maestros
        let keyMaestra = Object.keys(CONTACTOS_MAESTROS).find(key => nombreNorm.includes(key));
        if (keyMaestra) {
            numWa = CONTACTOS_MAESTROS[keyMaestra].wa;
            numTel = CONTACTOS_MAESTROS[keyMaestra].tel;
        }

        // 2. Complemento: Datos provenientes de OpenStreetMap
        let osmPhone = tags.phone || tags['contact:phone'] || tags['contact:mobile'] || "";
        if (osmPhone) {
            let telLimpio = osmPhone.replace(/[\s\-\(\)\+]/g, '');
            if (telLimpio.startsWith('09') || telLimpio.startsWith('5939')) {
                if (!numWa) numWa = telLimpio; // Solo asinga si el maestro no lo tenía
                if (!numTel) numTel = telLimpio;
            } else {
                if (!numTel) numTel = telLimpio; // Es un número fijo
            }
        }

        // 3. Renderizado Condicional Final
        let hayContacto = false;

        if (numWa) {
            hayContacto = true;
            btnWa.style.display = 'flex';
            let waClean = numWa.startsWith('09') ? '593' + numWa.substring(1) : numWa;
            // Heurística 7: Mensaje prellenado para eficiencia de uso
            btnWa.onclick = () => window.open(`https://wa.me/${waClean}?text=${encodeURIComponent("Hola, deseo consultar disponibilidad de un producto.")}`, '_blank');
        }

        if (numTel) {
            hayContacto = true;
            btnTel.style.display = 'flex';
            btnTel.onclick = () => window.open(`tel:${numTel}`, '_self');
        }

        if (hayContacto) {
            contenedorContactos.style.display = 'flex';
        }

        // ── NAVEGACIÓN ──────────────────────
        const btnNavegar = document.getElementById('btn-navegar');
        btnNavegar.onclick = () => {
            const latOrigen = parseFloat(ubicacionActiva[0]);
            const lngOrigen = parseFloat(ubicacionActiva[1]);
            const latDestino = parseFloat(farmacia.lat);
            const lngDestino = parseFloat(farmacia.lon);
            const urlMap = `https://www.google.com/maps/dir/?api=1&origin=${latOrigen},${lngOrigen}&destination=${latDestino},${lngDestino}`;
            window.open(urlMap, '_blank');
        };

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
                huboError = true;
                estaBuscando = false;
                if (overlay) {
                    overlay.innerHTML = `
                        <div class="loading-text" style="text-align: center; color: var(--color-superficie);">
                            <h2 style="color: var(--color-rojo-trafico); font-size: 1.2rem; margin-bottom: 10px;">Problema de Conexión</h2>
                            <p style="margin-bottom: 15px;">Parece que tu red está inestable o desconectada en este momento.</p>
                            <button id="btn-reintentar-api" style="background-color: var(--color-azul-rey); color: white; padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; min-height: 44px;">Reintentar</button>
                        </div>
                    `;
                    overlay.classList.remove('oculto');
                    document.getElementById('btn-reintentar-api').onclick = () => fetchFarmacias(radio, forzarOverpass);
                }
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
        mapaInicializado = true;
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

        if (mapaInicializado && markersGroup.getLayers().length === 0 && !estaBuscando) {
            mostrarAviso("Conexión restaurada. Buscando farmacias...");
            estaBuscando = true;
            fetchFarmacias();
        }
    });

    const btnExpandir = document.getElementById('btn-expandir-5km');
    if (btnExpandir) btnExpandir.onclick = () => { btnExpandir.classList.add('oculto'); fetchFarmacias(5000, true); };

    const btnRecenter = document.getElementById('btn-recenter');
    if (btnRecenter) btnRecenter.onclick = () => map.setView(ubicacionActiva, 15);

    const btnCerrarBs = document.getElementById('btn-cerrar-bs');
    if (btnCerrarBs) btnCerrarBs.onclick = cerrarBottomSheet;
});