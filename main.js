// Initialize map
const map = L.map('map').setView([45.1, -64.5], 16);

// Base layer
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

// Layer groups
const layerControl = L.control.layers({}, {}, {collapsed: false}).addTo(map);

// Stats counters
let treeCount = 0;
let pointCount = 0;
let contourCount = 0;

// Color mapping
const stressColors = {
    'Green': '#2ecc71',
    'Yellow': '#f1c40f',
    'Orange': '#e67e22',
    'Red': '#e74c3c',
    'NoLeaf': '#3498db'
};

// Legend
const legend = L.control({position: 'bottomleft'});
legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'legend');
    div.innerHTML += '<b>Leaf Stress</b><br>';
    for (const [label, color] of Object.entries(stressColors)) {
        div.innerHTML += `<i style="background:${color}"></i> ${label}<br>`;
    }
    return div;
};
legend.addTo(map);

// Common popup functions
function treePopup(feature) {
    const props = feature.properties;
    return `
    <b>Tree Polygon</b><br>
    Class: ${props.Class || props.MAJORITY || 'N/A'}<br>
    Confidence: ${props.Confidence || 'N/A'}<br>
    Area: ${props.Shape_Area ? props.Shape_Area.toFixed(2) : 'N/A'} m²<br>
    Length: ${props.Shape_Leng ? props.Shape_Leng.toFixed(2) : 'N/A'} m
    `;
}

function pointPopup(feature) {
    const props = feature.properties;
    return `
    <b>Field Point #${props.Point_ID || 'N/A'}</b><br>
    X: ${props.X?.toFixed(3) || 'N/A'}<br>
    Y: ${props.Y?.toFixed(3) || 'N/A'}<br>
    Ortho: ${props.Ortho?.toFixed(3) || 'N/A'}<br>
    Class: ${props.MAJORITY || 'N/A'}
    `;
}

function contourPopup(feature) {
    return `<b>Contour</b><br>Elevation: ${feature.properties.Contour} m`;
}

// Load GeoJSON helper
async function loadGeoJSON(path, name, style, popupFn) {
    try {
        const res = await fetch(path);
        const data = await res.json();
        
        const layer = L.geoJSON(data, {
            style: style,
            pointToLayer: function (feature, latlng) {
                return L.circleMarker(latlng, {
                    radius: 4,
                    fillColor: style.fillColor,
                    color: '#000',
                    weight: 1,
                    fillOpacity: 0.8
                });
            },
            onEachFeature: function (feature, layer) {
                layer.bindPopup(popupFn(feature));
            }
        });

        layerControl.addOverlay(layer, name);
        layer.addTo(map);

        // Update counts
        if (name.includes('Tree')) treeCount += data.features.length;
        if (name.includes('Point')) pointCount += data.features.length;
        if (name.includes('Contour')) contourCount += data.features.length;

        updateStats();
        
        // Fit map bounds on first load
        if (treeCount + pointCount + contourCount === data.features.length) {
            map.fitBounds(layer.getBounds());
        }

    } catch (e) {
        console.log(`Failed to load ${name}:`, e);
    }
}

function updateStats() {
    document.getElementById('trees').textContent = `Trees: ${treeCount}`;
    document.getElementById('points').textContent = `Field Points: ${pointCount}`;
    document.getElementById('contours').textContent = `Contours: ${contourCount}`;
}

// Load all layers
// Area 1
loadGeoJSON('data/GeoJson/Area1/Tree_Segmentation_with_Leaf_Classification_Area1_Green.json', 'Area 1 - Healthy (Green)', {color: stressColors.Green, weight:1, fillOpacity:0.6}, treePopup);
loadGeoJSON('data/GeoJson/Area1/Tree_Segmentation_with_Leaf_Classification_Area1_Yellow.json', 'Area 1 - Mild Stress', {color: stressColors.Yellow, weight:1, fillOpacity:0.6}, treePopup);
loadGeoJSON('data/GeoJson/Area1/Tree_Segmentation_with_Leaf_Classification_Area1_Orange.json', 'Area 1 - Moderate Stress', {color: stressColors.Orange, weight:1, fillOpacity:0.6}, treePopup);
loadGeoJSON('data/GeoJson/Area1/Tree_Segmentation_with_Leaf_Classification_Area1_Red.json', 'Area 1 - High Stress', {color: stressColors.Red, weight:1, fillOpacity:0.6}, treePopup);
loadGeoJSON('data/GeoJson/Area1/Tree_Segmentation_with_Leaf_Classification_Area1_Cyan_NoLeaf.json', 'Area 1 - Leafless', {color: stressColors.NoLeaf, weight:1, fillOpacity:0.6}, treePopup);
loadGeoJSON('data/GeoJson/Area1/Contour_Lines_1M_Area1.json', 'Area 1 - Contours', {color: '#333', weight: 0.5, fill: false}, contourPopup);

// Area 2
loadGeoJSON('data/GeoJson/Area2/Tree_Segmentation_with_Leaf_Classification_Area2_Green.json', 'Area 2 - Healthy (Green)', {color: stressColors.Green, weight:1, fillOpacity:0.6}, treePopup);
loadGeoJSON('data/GeoJson/Area2/Tree_Segmentation_with_Leaf_Classification_Area2_Yellow.json', 'Area 2 - Mild Stress', {color: stressColors.Yellow, weight:1, fillOpacity:0.6}, treePopup);
loadGeoJSON('data/GeoJson/Area2/Tree_Segmentation_with_Leaf_Classification_Area2_Orange.json', 'Area 2 - Moderate Stress', {color: stressColors.Orange, weight:1, fillOpacity:0.6}, treePopup);
loadGeoJSON('data/GeoJson/Area2/Tree_Segmentation_with_Leaf_Classification_Area2_Red.json', 'Area 2 - High Stress', {color: stressColors.Red, weight:1, fillOpacity:0.6}, treePopup);
loadGeoJSON('data/GeoJson/Area2/Tree_Segmentation_with_Leaf_Classification_Area2_Cyan_NoLeaf.json', 'Area 2 - Leafless', {color: stressColors.NoLeaf, weight:1, fillOpacity:0.6}, treePopup);
loadGeoJSON('data/GeoJson/Area2/Contour_Lines_1M_Area2.json', 'Area 2 - Contours', {color: '#333', weight: 0.5, fill: false}, contourPopup);
loadGeoJSON('data/GeoJson/Area2/Points_Area2_All.json', 'Area 2 - Field Points', {fillColor: '#8e44ad'}, pointPopup);
