// ─────────────────────────────────────────────────────────────────────────────
// The HTML document rendered inside MapPickerModal's WebView.
//
// Two backends, one contract. Whichever renders, it posts
//   { lat, lng, address?, city? }
// back over window.ReactNativeWebView.postMessage as the user moves the pin.
//
//   • Google Maps  — used when GOOGLE_MAPS_API_KEY is set. Adds a Places
//     search box, which is the whole reason to pay for a key: typing
//     "Apollo Hospital Bannerghatta" beats dragging a pin across India.
//   • Leaflet + OpenStreetMap — the keyless fallback the app shipped with.
//     No billing, works in Expo Go, still fully functional.
//
// Both use the same "pin fixed at the centre, drag the map underneath it"
// interaction. That deliberately avoids google.maps.Marker and
// google.maps.places.Autocomplete, both of which Google closed to new API
// keys / deprecated — a key created today cannot use the legacy Autocomplete
// at all, so this uses PlaceAutocompleteElement instead.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CENTRE = { lat: 20.5937, lng: 78.9629 }; // India centroid

// Centre pin + attribution, shared by both backends.
const SHARED_CSS = `
  html,body,#map{height:100%;margin:0;padding:0}
  #pin{
    position:absolute;left:50%;top:50%;z-index:5;
    width:30px;height:44px;margin-left:-15px;margin-top:-42px;
    pointer-events:none;
    background:no-repeat center/contain url("data:image/svg+xml;utf8,\
%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 44'%3E\
%3Cpath d='M15 0C6.7 0 0 6.7 0 15c0 11 15 29 15 29s15-18 15-29C30 6.7 23.3 0 15 0z' fill='%23821c03'/%3E\
%3Ccircle cx='15' cy='15' r='5.5' fill='%23fff'/%3E%3C/svg%3E");
    filter:drop-shadow(0 3px 4px rgba(0,0,0,.35));
  }
  #search{
    position:absolute;top:10px;left:10px;right:10px;z-index:10;
    border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.2);
    background:#fff;
  }
  gmp-place-autocomplete{width:100%;display:block}
`;

function googleHtml(lat, lng, apiKey) {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<style>${SHARED_CSS}</style>
</head><body>
<div id="search"></div>
<div id="map"></div>
<div id="pin"></div>
<script>
  var post = function (o) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch (e) {}
  };
  var map, lastAddress = null, lastCity = null;

  window.initMap = async function () {
    var start = { lat: ${lat}, lng: ${lng} };
    map = new google.maps.Map(document.getElementById('map'), {
      center: start,
      zoom: 15,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'greedy',
    });

    // 'idle' fires once the map settles after a pan/zoom. The pin never moves —
    // the map does — so the centre IS the picked point.
    map.addListener('idle', function () {
      var c = map.getCenter();
      post({ lat: c.lat(), lng: c.lng(), address: lastAddress, city: lastCity });
      // An address only describes the spot it came from; once the user drags
      // away from it, it is stale.
      lastAddress = null; lastCity = null;
    });

    try {
      var places = await google.maps.importLibrary('places');
      var ac = new places.PlaceAutocompleteElement();
      document.getElementById('search').appendChild(ac);
      ac.addEventListener('gmp-select', async function (ev) {
        var place = ev.placePrediction.toPlace();
        await place.fetchFields({ fields: ['formattedAddress', 'location', 'addressComponents'] });
        if (!place.location) return;
        lastAddress = place.formattedAddress || null;
        lastCity = null;
        (place.addressComponents || []).forEach(function (comp) {
          if ((comp.types || []).indexOf('locality') !== -1) lastCity = comp.longText || comp.long_name || null;
        });
        map.setCenter(place.location);
        map.setZoom(17);
      });
    } catch (e) {
      // Places not enabled on this key — the map still works, just without search.
      document.getElementById('search').style.display = 'none';
    }
  };
</script>
<script async src="https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&libraries=places&loading=async&callback=initMap"></script>
</body></html>`;
}

function leafletHtml(lat, lng) {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>${SHARED_CSS}</style>
</head><body>
<div id="map"></div>
<div id="pin"></div>
<script>
  var post = function (o) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch (e) {}
  };
  var map = L.map('map', { zoomControl: true }).setView([${lat}, ${lng}], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OpenStreetMap'
  }).addTo(map);
  // Same contract as the Google backend: the centre of the map is the pick.
  var emit = function () {
    var c = map.getCenter();
    post({ lat: c.lat, lng: c.lng, address: null, city: null });
  };
  map.on('moveend', emit);
  emit();
</script>
</body></html>`;
}

/**
 * @param {number|null|undefined} lat  starting latitude
 * @param {number|null|undefined} lng  starting longitude
 * @param {string} apiKey  Google Maps Platform key; '' → Leaflet/OSM fallback
 */
export function buildMapHtml(lat, lng, apiKey) {
  const startLat = Number.isFinite(lat) ? lat : DEFAULT_CENTRE.lat;
  const startLng = Number.isFinite(lng) ? lng : DEFAULT_CENTRE.lng;
  return apiKey
    ? googleHtml(startLat, startLng, apiKey)
    : leafletHtml(startLat, startLng);
}

export const MAP_DEFAULT_CENTRE = DEFAULT_CENTRE;
