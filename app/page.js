"use client";

import { Checkbox, MantineProvider } from "@mantine/core";
import React, { useEffect, useState, useRef } from "react";
import Nav from "@/components/Nav";
import CouncilDist from "./data/CouncilDistricts.json";
import geoData from "./data/output.json";
import geoDataFalse from "./data/output_false.json";
import combo_true from "./data/combo.json";
import bathroom_only from "./data/bathroom_only.json";
import water_only from "./data/water_only.json";
import mapboxgl from "mapbox-gl";
import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";
import "@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mantine/core/styles.css";

const optionsCd = [...Array(15)].map((_, i) => ({
  value: `${i + 1}`,
  label: `${i + 1}`,
}));

const Home = () => {
  const cdValues = optionsCd.map((entry) => entry.value);
  const [filteredCD, setFilteredCD] = useState(cdValues);
  const [filterpanelopened, setfilterpanelopened] = useState(false);
  const [selectedfilteropened, setselectedfilteropened] = useState("cd");
  const [selectAll, setSelectAll] = useState(true);
  const [showBathrooms, setShowBathrooms] = useState(true);
  const [showWaterFountains, setShowWaterFountains] = useState(true);
  const [showCombo, setShowCombo] = useState(true);
  const mapref = useRef(null);
  const divRef = useRef(null);

  const applyLayerFilter = (layerId, districts) => {
    if (!mapref.current || !mapref.current.getLayer(layerId)) return;
    if (!districts || districts.length === 0) {
      mapref.current.setFilter(layerId, ["in", "Council District", ""]); // hide all
    } else {
      const parsed = districts.map((v) => parseInt(v));
      mapref.current.setFilter(layerId, [
        "in",
        ["get", "Council District"],
        ["literal", parsed],
      ]);
    }
  };

  const applyBathroomFilter = () => {
    const layers = ['restrooms-layer', 'restrooms-baby', 'restrooms-shower', 'manual-restrooms-layer'];
    layers.forEach(layerId => {
      if (mapref.current && mapref.current.getLayer(layerId)) {
        // Only show layers with actual toilets (filter out locations with 0 toilets)
        if (showBathrooms) {
          mapref.current.setLayoutProperty(layerId, 'visibility', 'visible');
          // Add filter to only show locations with toilets > 0
          if (layerId === 'restrooms-layer') {
            mapref.current.setFilter(layerId, [
              'all',
              ['>', ['to-number', ['get', 'No. of Toilets']], 0]
            ]);
          }
        } else {
          mapref.current.setLayoutProperty(layerId, 'visibility', 'none');
        }
      }
    });
  };

  const applyWaterFountainFilter = () => {
    const layers = ['hydration', 'water_only_layer'];
    layers.forEach(layerId => {
      if (mapref.current && mapref.current.getLayer(layerId)) {
        mapref.current.setLayoutProperty(layerId, 'visibility', showWaterFountains ? 'visible' : 'none');
      }
    });
  };

  const applyComboFilter = () => {
    const layers = ['combo-layer', 'combo-layer-for-hydration'];
    layers.forEach(layerId => {
      if (mapref.current && mapref.current.getLayer(layerId)) {
        mapref.current.setLayoutProperty(layerId, 'visibility', showCombo ? 'visible' : 'none');
      }
    });
  };

  const applyAllFilters = (districts) => {
    // manual-restrooms remain always visible
    applyBathroomFilter();
    applyWaterFountainFilter();
    applyComboFilter();
    ["hydration", "restrooms-layer", "restrooms-baby", "restrooms-shower", 'combo-layer-for-hydration', 'combo-layer'].forEach((id) =>
      applyLayerFilter(id, districts)
    );
  };

  const boostStreetLabels = () => {
    if (!mapref.current) return;
    try {
      const style = mapref.current.getStyle();
      if (!style?.layers) return;

      const labelIds = style.layers
        .filter(
          (l) =>
            l.type === "symbol" &&
            /label/i.test(l.id) &&
            /road|street|highway|motorway/i.test(l.id)
        )
        .map((l) => l.id);

      labelIds.forEach((id) => {
        mapref.current.setLayoutProperty(id, "text-size", [
          "interpolate",
          ["linear"],
          ["zoom"],
          10, 12,
          14, 15,
          16, 18,
        ]);
      });
    } catch { }
  };

  useEffect(() => {
    mapboxgl.accessToken =
      "pk.eyJ1Ijoia2VubmV0aG1lamlhIiwiYSI6ImNseGV6b3c0djAyOGYyc3B3a3Bzd2xtNXEifQ.iNXcgdwigbqLTpSYbMJUOg";

    const map = new mapboxgl.Map({
      container: divRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-118.41, 34],
      zoom: 10,
    });

    mapref.current = map;

    // Controls
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showAccuracyCircle: true,
        showUserHeading: true,
        fitBoundsOptions: { maxZoom: 16 },
      }),
      "top-right"
    );

    // Geocoder
    const geocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      mapboxgl,
      marker: false,
      placeholder: "Search address or place…",
      countries: "us",
      types: "address,poi",
      proximity: { longitude: -118.41, latitude: 34.0 },
    });
    geocoder.addTo("#geocoder");
    geocoder.on("result", (e) => {
      const center = e?.result?.center;
      if (center) map.flyTo({ center, zoom: 16, speed: 0.8, curve: 1.4 });
    });

    // const restroomsGeoData = { type: "FeatureCollection", features: restroomsData?.features };
    const CouncilDistData = {
      type: "FeatureCollection",
      features: CouncilDist.features.map((feature) => ({
        type: "Feature",
        geometry: { type: "MultiPolygon", coordinates: feature.geometry.coordinates },
        properties: {
          dist_name: feature.properties.dist_name,
          district: feature.properties.district,
          name: feature.properties.name,
          objectid: feature.properties.OBJECTID,
        },
      })),
    };

    map.on("load", () => {
      boostStreetLabels();

      // Load icons
      map.loadImage("/restroom.png", (error, image) => {
        if (error) throw error;
        if (!map.hasImage("restroom-icon")) map.addImage("restroom-icon", image, { pixelRatio: 2 });

        map.loadImage("/drop.png", (error2, image2) => {
          if (error2) throw error2;
          if (!map.hasImage("fountain-icon")) map.addImage("fountain-icon", image2, { pixelRatio: 2 });

          map.loadImage("/baby.png", (e3, babyImg) => {
            if (!e3 && !map.hasImage("baby-icon")) map.addImage("baby-icon", babyImg, { pixelRatio: 2 });

            map.loadImage("/shower.png", (e4, showerImg) => {
              if (!e4 && !map.hasImage("shower-icon")) map.addImage("shower-icon", showerImg, { pixelRatio: 2 });

              map.loadImage("/combo.png", (err, comboImg) => {
                if (!err && !map.hasImage("combo-icon")) {
                  map.addImage("combo-icon", comboImg, { pixelRatio: 2 });
                }
              });

              // ---------- Helpers: geocode + distance ----------
              const deg2rad = (d) => (d * Math.PI) / 180;
              const haversineMeters = (a, b) => {
                // a, b: [lng, lat]
                const R = 6371000;
                const dLat = deg2rad(b[1] - a[1]);
                const dLng = deg2rad(b[0] - a[0]);
                const lat1 = deg2rad(a[1]);
                const lat2 = deg2rad(b[1]);
                const sin1 = Math.sin(dLat / 2);
                const sin2 = Math.sin(dLng / 2);
                const h =
                  sin1 * sin1 +
                  Math.cos(lat1) * Math.cos(lat2) * sin2 * sin2;
                return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
              };
              const isWithinAny = (coord, centers, radiusM) =>
                centers.some((c) => haversineMeters(coord, c) <= radiusM);

              const geocodeAddresses = async (addresses) => {
                const out = [];
                for (const addr of addresses) {
                  try {
                    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
                      addr + ", Los Angeles, CA"
                    )}.json?access_token=${mapboxgl.accessToken}&limit=1&country=US&proximity=-118.242,34.053`;
                    const res = await fetch(url);
                    const data = await res.json();
                    const match = data?.features?.[0];
                    if (match?.center) out.push({ addr, center: match.center });
                  } catch { }
                }
                return out;
              };

              (async () => {
                // Geocode the two addresses first
                const manualAddrs = ["509 S. San Julian St.", "814 E. 6th St.", "204 E. 5th St.", "545 S. San Pedro St."];
                const manualPoints = await geocodeAddresses(manualAddrs);
                const manualCenters = manualPoints.map((p) => p.center);

                // Build MANUAL RESTROOMS GeoJSON (toilet icons) - only for locations with actual bathrooms
                // Filter out locations that don't have bathrooms (like LA Mirada Park)
                const locationsWithoutBathrooms = ["5401 La Mirada Avenue"];
                const manualRestroomsFiltered = manualPoints.filter(p =>
                  !locationsWithoutBathrooms.some(addr => p.addr.includes(addr.split(' ')[0]))
                );

                const manualRestrooms = {
                  type: "FeatureCollection",
                  features: manualRestroomsFiltered.map((p) => ({
                    type: "Feature",
                    geometry: { type: "Point", coordinates: p.center },
                    properties: {
                      "Facility Name": "Restroom",
                      Address: p.addr,
                    },
                  })),
                };
                // 5401 La Mirada avenue  address - LA Mirada Park. It's showing toilet icons at park locations where there isn't a bathroom and i dont see these locations on the map 204 E. 5th St. 545 S. San Pedro St.
                // and also add Filter by bathrooms and water fountains . 
                // Filter HYDRATION dataset to remove any point near the two addresses (<= 80m)
                // and keep only those with fountains/hydration counts > 0
                const hydrationFiltered = {
                  type: "FeatureCollection",
                  features: (geoData?.features || []).filter((f) => {
                    try {
                      if (!f?.geometry || f.geometry.type !== "Point") return false;
                      const coords = f.geometry.coordinates;
                      const props = f.properties || {};
                      const fountains = Number(props["No. of Water Fountains"] || 0);
                      const stations = Number(props["No. of Hydration Stations"] || 0);
                      const hasWater = fountains > 0 || stations > 0;
                      if (!hasWater) return false;
                      // exclude if within 80m of either manual restroom
                      return !isWithinAny(coords, manualCenters, 80);
                    } catch {
                      return false;
                    }
                  }),
                };

                // ---------- Sources ----------
                map.addSource("restroom-source-for-combo", { type: "geojson", data: combo_true });
                map.addSource("restroom-source", { type: "geojson", data: bathroom_only });
                map.addSource("water_only-source", { type: "geojson", data: water_only });
                map.addSource("hydration-source-for-combo", { type: "geojson", data: geoData });
                map.addSource("hydration-source", { type: "geojson", data: geoDataFalse });
                map.addSource("cd-boundaries-source", { type: "geojson", data: CouncilDistData });
                if (manualRestrooms.features.length) {
                  map.addSource("manual-restrooms-source", { type: "geojson", data: manualRestrooms });
                }

                // ---------- Layers ----------
                map.addLayer({
                  id: "cd-boundaries",
                  type: "line",
                  source: "cd-boundaries-source",
                  paint: { "line-color": "white", "line-width": 1 },
                });

                map.addLayer({
                  id: "combo-layer-for-hydration",
                  type: "symbol",
                  source: "hydration-source-for-combo",
                  layout: {
                    "icon-image": "combo-icon",
                    "icon-allow-overlap": true,
                    "icon-anchor": "bottom",
                    "icon-size": [
                      "interpolate",
                      ["linear"],
                      ["zoom"],
                      10, 0.12,
                      14, 0.18,
                      16, 0.24,
                    ],
                  },
                });

                map.addLayer({
                  id: "hydration",
                  type: "symbol",
                  source: "hydration-source",
                  layout: {
                    "icon-image": "fountain-icon",
                    "icon-allow-overlap": true,
                    "icon-anchor": "bottom",
                    "icon-size": [
                      "interpolate",
                      ["linear"],
                      ["zoom"],
                      10, 0.15,
                      14, 0.22,
                      16, 0.28,
                    ],
                  }
                });

                                map.addLayer({
                  id: "water_only_layer",
                  type: "symbol",
                  source: "water_only-source",
                  layout: {
                    "icon-image": "fountain-icon",
                    "icon-allow-overlap": true,
                    "icon-anchor": "bottom",
                    "icon-size": [
                      "interpolate",
                      ["linear"],
                      ["zoom"],
                      10, 0.15,
                      14, 0.22,
                      16, 0.28,
                    ],
                  }
                });

                // Restrooms (toilet)
                map.addLayer({
                  id: "restrooms-layer",
                  type: "symbol",
                  source: "restroom-source",
                  layout: {
                    "icon-image": "restroom-icon",
                    "icon-allow-overlap": true,
                    "icon-anchor": "bottom",
                    "icon-size": [
                      "interpolate",
                      ["linear"],
                      ["zoom"],
                      10, 0.12,
                      14, 0.18,
                      16, 0.24,
                    ],
                  },
                  // filter: ["==", ["get", "Combo"], 0]
                });

                map.addLayer({
                  id: "combo-layer",
                  type: "symbol",
                  source: "restroom-source-for-combo",
                  layout: {
                    "icon-image": "combo-icon",
                    "icon-allow-overlap": true,
                    "icon-anchor": "bottom",
                    "icon-size": [
                      "interpolate",
                      ["linear"],
                      ["zoom"],
                      10, 0.15,
                      14, 0.22,
                      16, 0.28,
                    ],
                  },
                });

                if (map.hasImage("baby-icon")) {
                  map.addLayer({
                    id: "restrooms-baby",
                    type: "symbol",
                    source: "restrooms-source",
                    layout: {
                      "icon-image": "baby-icon",
                      "icon-allow-overlap": true,
                      "icon-anchor": "bottom",
                      "icon-offset": [-12, 0],
                      "icon-size": [
                        "interpolate",
                        ["linear"],
                        ["zoom"],
                        10, 0.1,
                        14, 0.14,
                        16, 0.18,
                      ],
                    },
                    filter: [
                      ">",
                      ["to-number", ["coalesce", ["get", "No. of Baby Changing Stations"], 0]],
                      0,
                    ],
                  });
                }

                if (map.hasImage("shower-icon")) {
                  map.addLayer({
                    id: "restrooms-shower",
                    type: "symbol",
                    source: "restrooms-source",
                    layout: {
                      "icon-image": "shower-icon",
                      "icon-allow-overlap": true,
                      "icon-anchor": "bottom",
                      "icon-offset": [12, 0],
                      "icon-size": [
                        "interpolate",
                        ["linear"],
                        ["zoom"],
                        10, 0.1,
                        14, 0.14,
                        16, 0.18,
                      ],
                    },
                    filter: [
                      ">",
                      ["to-number", ["coalesce", ["get", "No. of Showers"], 0]],
                      0,
                    ],
                  });
                }

                // Manual restroom pins (toilet)
                if (map.getSource("manual-restrooms-source")) {
                  map.addLayer({
                    id: "manual-restrooms-layer",
                    type: "symbol",
                    source: "manual-restrooms-source",
                    layout: {
                      "icon-image": "restroom-icon",
                      "icon-allow-overlap": true,
                      "icon-anchor": "bottom",
                      "icon-size": [
                        "interpolate",
                        ["linear"],
                        ["zoom"],
                        10, 0.12,
                        14, 0.18,
                        16, 0.24,
                      ],
                    },
                  });
                }

                // ---------- Tooltips (layer-aware icon) ----------
                const hoverPopup = new mapboxgl.Popup({
                  closeButton: false,
                  closeOnClick: false,
                  offset: 10,
                });

                const safe = (v) => (v === undefined || v === null || v === "" ? "—" : v);

                const buildHTML = (p = {}, layerId = "") => {
                  const Name = p["Name"] || p["Facility Name"] || p.name || p.Facility || "";
                  const CouncilDistrict =
                    p["Council District"] ?? p.CouncilDistrict ?? p.district ?? "";
                  const Address = p["Address"] || p["Facility Address"] || p.address || "";

                  const NoHydration = p["No. of Hydration Stations"];
                  const NoFountains = p["No. of Water Fountains"];
                  const NoSinks = p["No. of Sinks"];
                  const NoToilets = p["No. of Toilets"];
                  const NoUrinals = p["No. of Urinals"];

                  const Women = p["Women"];
                  const Men = p["Men"];
                  const GenderNeutral = p["Gender Neutral"];
                  const BabyChanging = p["No. of Baby Changing Stations"];
                  const Showers = p["No. of Showers"];
                  const combo = p["Combo"];

                  // const isRestroomLayer = /^restrooms|^manual-restrooms/.test(layerId);
                  // const icon = isRestroomLayer ? "/restroom.png" : "/drop.png";

                  const isCombo = String(combo).toLowerCase() === "1";
                  let icon;
                  console.log(isCombo)
                  if (isCombo) {
                    icon = "/combo.png";
                  } else if (/^restrooms|^manual-restrooms/.test(layerId)) {
                    icon = "/restroom.png";
                  } else {
                    icon = "/drop.png";
                  }

                  return `
                  <div style="font-size:12px;line-height:1.35;">
                    <img src="${icon}" alt="icon" style="width:30px;height:30px;object-fit:contain;" />
                    <div><strong>Name:</strong> ${safe(Name)}</div>
                    <div><strong>Council District:</strong> ${safe(CouncilDistrict)}</div>
                    <div><strong>Address:</strong> ${safe(Address)}</div>
                    <div><strong>No. of Hydration Stations:</strong> ${safe(NoHydration)}</div>
                    <div><strong>No. of Water Fountains:</strong> ${safe(NoFountains)}</div>
                    <div><strong>No. of Sinks:</strong> ${safe(NoSinks)}</div>
                    <div><strong>Women’s Restrooms </strong> ${safe(Women)}</div>
                    <div><strong>Men’s Restrooms </strong> ${safe(Men)}</div>
                    <div><strong>Gender Neutral Restrooms </strong> ${safe(GenderNeutral)}</div>
                    <div><strong>No. of Toilets :</strong> ${safe(NoToilets)}</div>
                    <div><strong>No. of Urinals:</strong> ${safe(NoUrinals)}</div>
                    <div><strong>No. of Baby Changing Stations:</strong> ${safe(BabyChanging)}</div>
                    <div><strong>No. of Showers:</strong> ${safe(Showers)}</div>
                  </div>
                `;
                };

                const attachTooltip = (layerId) => {
                  if (!map.getLayer(layerId)) return;

                  map.on("mouseenter", layerId, (e) => {
                    map.getCanvas().style.cursor = "pointer";
                    const f = e.features?.[0];
                    if (!f) return;
                    const coords =
                      f.geometry.type === "Point"
                        ? f.geometry.coordinates
                        : [e.lngLat.lng, e.lngLat.lat];
                    hoverPopup
                      .setLngLat(coords)
                      .setHTML(buildHTML(f.properties, layerId))
                      .addTo(map);
                  });

                  map.on("mousemove", layerId, (e) => {
                    const f = e.features?.[0];
                    if (!f) return;
                    const coords =
                      f.geometry.type === "Point"
                        ? f.geometry.coordinates
                        : [e.lngLat.lng, e.lngLat.lat];
                    hoverPopup.setLngLat(coords);
                  });

                  map.on("mouseleave", layerId, () => {
                    map.getCanvas().style.cursor = "";
                    hoverPopup.remove();
                  });

                  map.on("click", layerId, (e) => {
                    const f = e.features?.[0];
                    if (!f) return;
                    const coords =
                      f.geometry.type === "Point"
                        ? f.geometry.coordinates
                        : [e.lngLat.lng, e.lngLat.lat];
                    new mapboxgl.Popup({ offset: 12 })
                      .setLngLat(coords)
                      .setHTML(buildHTML(f.properties, layerId))
                      .addTo(map);
                  });
                };

                ["hydration", "restrooms-layer", "restrooms-baby", "restrooms-shower", "manual-restrooms-layer", "combo-layer", "combo-layer-for-hydration", "water_only_layer"]
                  .filter((id) => map.getLayer(id))
                  .forEach(attachTooltip);

                // Initial CD filters for main datasets
                applyAllFilters(filteredCD);
              })();
            }); // shower load
          }); // baby load
        }); // drop load
      }); // restroom load
    });

    return () => map.remove();
  }, []); // mount once

  useEffect(() => {
    applyAllFilters(filteredCD);
  }, [filteredCD]);

  useEffect(() => {
    applyBathroomFilter();
    applyWaterFountainFilter();
    applyComboFilter();
  }, [showBathrooms, showWaterFountains, showCombo]);

  const setfilteredcouncildistrictspre = (event) => {
    if (event === "") {
      setSelectAll(!selectAll);
      setFilteredCD(cdValues);
    } else if (event === "sndk") {
      setFilteredCD([]);
    } else {
      setFilteredCD(event);
    }
  };

  return (
    <div>
      <MantineProvider>
        <div className="flex-none">
          <Nav />
        </div>

        {/* Top header with title + geocoder host */}
        <div className="absolute mt-[3.5em] ml-2 md:ml-3 top-0 z-50 w-full">
          <div className="flex justify-between w-full h-10">
            <div className="md:ml-3 ml-2 text-base font-bold bg-[#212121] p-3 text-white">
              <strong>City of LA Bathrooms and Drinking Fountains</strong>
            </div>
            <div className="geocoder mr-4 ml-1 mt-2" id="geocoder"></div>
          </div>
          <button
            onClick={() => setfilterpanelopened(!filterpanelopened)}
            className="mt-2 rounded-full px-3 pb-1.5 pt-0.5 text-sm bg-gray-800 bg-opacity-80 text-white border-white border-2"
          >
            Filter
          </button>
        </div>

        {/* Filter panel */}
        <div
          id="cd-filter-panel"
          className={`bottom-0 sm:bottom-auto md:mt-[7.6em] md:ml-3 w-screen sm:w-auto z-50 ${filterpanelopened ? "absolute" : "hidden"
            }`}
        >
          <div className="bg-zinc-900 w-content bg-opacity-90 px-2 py-1 mt-1 sm:rounded-lg">
            {/* <div className="gap-x-0 flex flex-row w-full">
              <button
                onClick={() => setselectedfilteropened("cd")}
                className={`px-2 border-b-2 py-1 font-semibold ${selectedfilteropened === "cd"
                  ? "border-[#41ffca] text-[#41ffca]"
                  : "hover:border-white border-transparent text-gray-50"
                  }`}
              >
                CD #
              </button>
            </div> */}

            {selectedfilteropened === "cd" && (
              <div className="pl-5 pr-2 py-2">
                {/* <button
                  className="align-middle text-white rounded-lg px-1 border border-gray-400 text-sm md:text-base"
                  onClick={() => setfilteredcouncildistrictspre(cdValues, "Council District")}
                >
                  Select All
                </button>
                <button
                  className="align-middle text-white rounded-lg px-1 border border-gray-400 text-sm md:text-base"
                  onClick={() => setfilteredcouncildistrictspre("sndk", "Council District")}
                >
                  Unselect All
                </button> */}
             
                {/* <Checkbox.Group
                  value={filteredCD}
                  onChange={(event) => setfilteredcouncildistrictspre(event, "Council District")}
                >
                  <div className="grid grid-cols-3 gap-x-4 my-2">
                    {optionsCd.map((eachEntry) => (
                      <Checkbox
                        key={eachEntry.value}
                        id={eachEntry.value}
                        value={eachEntry.value}
                        label={<span className="text-white text-xs">{eachEntry.label}</span>}
                        className="my-2"
                      />
                    ))}
                  </div>
                </Checkbox.Group> */}

                {/* Bathroom and Water Fountain Filters */}
                <div className="mt-4 space-y-2">
  <p className="text-white text-sm font-semibold">Show facilities with:</p>
  
  <div className="flex items-center space-x-2">
    <input
      type="checkbox"
      id="bathrooms-filter"
      checked={showBathrooms}
      onChange={(e) => setShowBathrooms(e.target.checked)}
      className="text-blue-600"
    />
    <label htmlFor="bathrooms-filter" className="text-white text-sm">
      Bathrooms Only
    </label>
  </div>

  <div className="flex items-center space-x-2">
    <input
      type="checkbox"
      id="fountains-filter"
      checked={showWaterFountains}
      onChange={(e) => setShowWaterFountains(e.target.checked)}
      className="text-blue-600"
    />
    <label htmlFor="fountains-filter" className="text-white text-sm">
      Water Fountains Only
    </label>
  </div>

  <div className="flex items-center space-x-2">
    <input
      type="checkbox"
      id="combo-filter"
      checked={showCombo}
      onChange={(e) => setShowCombo(e.target.checked)}
      className="text-blue-600"
    />
    <label htmlFor="combo-filter" className="text-white text-sm">
      Water Fountains and Bathrooms
    </label>
  </div>
</div>


                {/* Sources */}
                <div className="mt-3 space-y-1">
                  <div>
                    <a
                      href="https://cityclerk.lacity.org/onlinedocs/2024/24-0708_rpt_drp_04-18-25.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#41ffca] text-xs underline hover:text-white"
                    >
                      Department of Recreation and Parks 2025 report
                    </a>
                  </div>
                  <div>
                    <a
                      href="https://cityclerk.lacity.org/onlinedocs/2024/24-0708_rpt_LD_10-31-24.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#41ffca] text-xs underline hover:text-white"
                    >
                      LA Public Library 2024 report
                    </a>
                  </div>
                  <div>
                    <a
                      href=""
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#41ffca] text-xs underline hover:text-white"
                    >
                      Bureau of Streets Services
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div ref={divRef} style={{ width: "100%", height: "100vh" }} />
      </MantineProvider>

      {/* Footer logos */}
      <div className="absolute md:mx-auto bottom-2 left-1 md:left-1/2 md:transform md:-translate-x-1/2">
        <a href="https://controller.lacity.gov/" target="_blank" rel="noopener noreferrer">
          <img
            src="https://controller.lacity.gov/images/KennethMejia-logo-white-elect.png"
            className="h-9 md:h-10 z-40"
            alt="Kenneth Mejia LA City Controller Logo"
          />
        </a>
      </div>

      {/* Global tweaks */}
      <style jsx global>{`
        .mapboxgl-ctrl-top-right {
          top: 72px !important;
        }
        #geocoder .mapboxgl-ctrl-geocoder {
          margin-top: 8px;
          min-width: 280px;
        }
        #geocoder .mapboxgl-ctrl-geocoder--input {
          height: 32px;
        }
        #cd-filter-panel {
          top: 120px;
        }
      `}</style>
    </div>
  );
};

export default Home;
