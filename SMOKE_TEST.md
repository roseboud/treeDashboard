# Smoke Test Checklist — Hutchinson Acres Dashboard

- [ ] `npm run dev` starts on port 5173, no console errors
- [ ] 2D map centres on Hutchinson Acres area at zoom 16
- [ ] All 22 GeoJSON layers listed and labelled in layer panel
- [ ] Toggling checkbox adds/removes layer from map
- [ ] Click tree polygon → popup shows Condition, Code, Confidence, Area
- [ ] Click field point → popup shows Point_ID, Classification, Ortho, X, Y
- [ ] Click contour line → popup shows elevation value
- [ ] Stats panel shows non-zero counts for trees, points, contours
- [ ] "Switch to 3D" hides 2D map, shows Potree container
- [ ] No data/potree/ → fallback message visible, no JS error in console
- [ ] data/potree/cloud.js present → point cloud loads, camera orbits
- [ ] "Switch to 2D" restores map without page reload, no memory error
- [ ] NDVI COG layer loads on toggle, no CORS error
- [ ] `npm run build` exits 0 with zero TypeScript errors
- [ ] dist/ folder produced; assets include all data files
