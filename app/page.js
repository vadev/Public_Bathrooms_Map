"use client";
import { Checkbox, MantineProvider } from "@mantine/core";
import React, { useEffect, useState, useRef } from "react";
import Nav from "@/components/Nav";
import CouncilDist from "./data/CouncilDistricts.json";
import geoData from "./data/output.json";
import restroomsData from "./data/restrooms_water_fountains_cleaned.json";
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

  const applyAllFilters = (districts) => {
    ["hydration", "restrooms-layer", "restrooms-baby", "restrooms-shower"].forEach((id) =>
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
        mapref.current.setLayoutProperty(
          id,
          "text-size",
          [
            "interpolate",
            ["linear"],
            ["zoom"],
            10, 12,
            14, 15,
            16, 18
          ]
        );
      });
    } catch {}
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

    // Controls: zoom/rotate + geolocate (“Locate me”)
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

    // Geocoder (address/POI search) into #geocoder div
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

    const geoJsonData = {
      type: "FeatureCollection",
      features: geoData?.features,
    };

    const restroomsGeoData = {
      type: "FeatureCollection",
      features: restroomsData?.features,
    };

    const CouncilDistData = {
      type: "FeatureCollection",
      features: CouncilDist.features.map((feature) => ({
        type: "Feature",
        geometry: {
          type: "MultiPolygon",
          coordinates: feature.geometry.coordinates,
        },
        properties: {
          dist_name: feature.properties.dist_name,
          district: feature.properties.district,
          name: feature.properties.name,
          objectid: feature.properties.OBJECTID,
        },
      })),
    };

    map.on("load", () => {
      // Make cross streets more readable
      boostStreetLabels();

      // Load icons (restroom + hydration)
      map.loadImage("/restroom.png", (error, image) => {
        if (error) throw error;
        if (!map.hasImage("restroom-icon"))
          map.addImage("restroom-icon", image, { pixelRatio: 2 });

        map.loadImage("/drop.png", (error2, image2) => {
          if (error2) throw error2;
          if (!map.hasImage("fountain-icon"))
            map.addImage("fountain-icon", image2, { pixelRatio: 2 });

          // OPTIONAL: Baby & Shower small icons (only show where counts > 0)
          map.loadImage("/baby.png", (e3, babyImg) => {
            if (!e3 && !map.hasImage("baby-icon"))
              map.addImage("baby-icon", babyImg, { pixelRatio: 2 });

            map.loadImage("/shower.png", (e4, showerImg) => {
              if (!e4 && !map.hasImage("shower-icon"))
                map.addImage("shower-icon", showerImg, { pixelRatio: 2 });

              // Sources
              map.addSource("hydration-source", {
                type: "geojson",
                data: geoJsonData,
              });
              map.addSource("restrooms-source", {
                type: "geojson",
                data: restroomsGeoData,
              });
              map.addSource("cd-boundaries-source", {
                type: "geojson",
                data: CouncilDistData,
              });

              // District boundaries
              map.addLayer({
                id: "cd-boundaries",
                type: "line",
                source: "cd-boundaries-source",
                paint: { "line-color": "white", "line-width": 1 },
              });

              // Hydration (icon)
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
                    10, 0.12,
                    14, 0.18,
                    16, 0.24,
                  ],
                },
              });

              // Restrooms (main icon)
              map.addLayer({
                id: "restrooms-layer",
                type: "symbol",
                source: "restrooms-source",
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

              // Baby-changing icon (shows only where count > 0)
              if (map.hasImage("baby-icon")) {
                map.addLayer({
                  id: "restrooms-baby",
                  type: "symbol",
                  source: "restrooms-source",
                  layout: {
                    "icon-image": "baby-icon",
                    "icon-allow-overlap": true,
                    "icon-anchor": "bottom",
                    "icon-offset": [-12, 0], // left of restroom icon
                    "icon-size": [
                      "interpolate",
                      ["linear"],
                      ["zoom"],
                      10, 0.10,
                      14, 0.14,
                      16, 0.18,
                    ],
                  },
                  filter: [
                    ">",
                    [
                      "to-number",
                      ["coalesce", ["get", "No. of Baby Changing Stations"], 0],
                    ],
                    0,
                  ],
                });
              }

              // Shower icon (shows only where count > 0)
              if (map.hasImage("shower-icon")) {
                map.addLayer({
                  id: "restrooms-shower",
                  type: "symbol",
                  source: "restrooms-source",
                  layout: {
                    "icon-image": "shower-icon",
                    "icon-allow-overlap": true,
                    "icon-anchor": "bottom",
                    "icon-offset": [12, 0], // right of restroom icon
                    "icon-size": [
                      "interpolate",
                      ["linear"],
                      ["zoom"],
                      10, 0.10,
                      14, 0.14,
                      16, 0.18,
                    ],
                  },
                  filter: [
                    ">",
                    [
                      "to-number",
                      ["coalesce", ["get", "No. of Showers"], 0],
                    ],
                    0,
                  ],
                });
              }

              applyAllFilters(filteredCD);

              // Tooltip setup
              const hoverPopup = new mapboxgl.Popup({
                closeButton: false,
                closeOnClick: false,
                offset: 10,
              });

              const safe = (v) =>
                v === undefined || v === null || v === "" ? "—" : v;

              const buildHTML = (p = {}) => {
                const Name =
                  p["Name"] || p["Facility Name"] || p.name || p.Facility || "";
                const CouncilDistrict =
                  p["Council District"] ?? p.CouncilDistrict ?? p.district ?? "";
                const Address =
                  p["Address"] || p["Facility Address"] || p.address || "";

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

                return `
                  <div style="font-size:12px;line-height:1.35;">
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
                map.on("mouseenter", layerId, (e) => {
                  map.getCanvas().style.cursor = "pointer";
                  const f = e.features?.[0];
                  if (!f) return;
                  const coords =
                    f.geometry.type === "Point"
                      ? f.geometry.coordinates
                      : [e.lngLat.lng, e.lngLat.lat];
                  hoverPopup.setLngLat(coords).setHTML(buildHTML(f.properties)).addTo(map);
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
                    .setHTML(buildHTML(f.properties))
                    .addTo(map);
                });
              };

              attachTooltip("hydration");
              attachTooltip("restrooms-layer");
              if (map.getLayer("restrooms-baby")) attachTooltip("restrooms-baby");
              if (map.getLayer("restrooms-shower")) attachTooltip("restrooms-shower");
            });
          });
        });
      });
    });

    return () => map.remove();
  }, []);

  useEffect(() => {
    applyAllFilters(filteredCD);
  }, [filteredCD]);

  const setfilteredcouncildistrictspre = (event, type) => {
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
        <div className="absolute mt-[3.5em] ml-2 md:ml-3 top-0 z-5 z-50 w-full">
          <div className="flex justify-between w-full h-10">
            <div className="md:ml-3 ml-2 text-base font-bold bg-[#212121] p-3 text-white">
              <strong>City of LA Bathrooms and Drinking Fountains</strong>
            </div>
           
            {/* nudge the geocoder slightly down via margin (plus global CSS below) */}
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
          className={`bottom-0 sm:bottom-auto md:mt?[7.6em] md:ml-3 w-screen sm:w-auto z-50 ${
            filterpanelopened ? "absolute" : "hidden"
          }`}
        >
 
          <div className="bg-zinc-900 w-content bg-opacity-90 px-2 py-1 mt-1 sm:rounded-lg">
            <div className="gap-x-0 flex flex-row w-full">
              <button
                onClick={() => setselectedfilteropened("cd")}
                className={`px-2 border-b-2 py-1 font-semibold ${
                  selectedfilteropened === "cd"
                    ? "border-[#41ffca] text-[#41ffca]"
                    : "hover:border-white border-transparent text-gray-50"
                }`}
              >
                CD #
              </button>
            </div>

            {selectedfilteropened === "cd" && (
              <div className="pl-5 pr-2 py-2">
                <button
                  className="align-middle text-white rounded-lg px-1 border border-gray-400 text-sm md:text-base"
                  onClick={() => {
                    setfilteredcouncildistrictspre(cdValues, "Council District");
                  }}
                >
                  Select All
                </button>
                <button
                  className="align-middle text-white rounded-lg px-1 border border-gray-400 text-sm md:text-base"
                  onClick={() => {
                    setfilteredcouncildistrictspre("sndk", "Council District");
                  }}
                >
                  Unselect All
                </button>
                <br />
                <Checkbox.Group
                  value={filteredCD}
                  onChange={(event) =>
                    setfilteredcouncildistrictspre(event, "Council District")
                  }
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
                </Checkbox.Group>

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
        <a
          href="https://controller.lacity.gov/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src="https://controller.lacity.gov/images/KennethMejia-logo-white-elect.png"
            className="h-9 md:h-10 z-40"
            alt="Kenneth Mejia LA City Controller Logo"
          />
        </a>
      </div>

      {/* Global tweaks to push controls + geocoder a little down */}
      <style jsx global>{`
        .mapboxgl-ctrl-top-right {
          top: 72px !important; /* moves zoom/geolocate down a bit */
        }
        #geocoder .mapboxgl-ctrl-geocoder {
          margin-top: 8px; /* nudges the search bar down */
          min-width: 280px;
        }
        /* Optional: tighten the geocoder input height for your compact header */
        #geocoder .mapboxgl-ctrl-geocoder--input {
          height: 32px;
        }
      `}</style>
                <style jsx global>{`
  #cd-filter-panel {
    top: 120px; /* adjust to taste */
  }
`}</style>
    </div>
  );
};

export default Home;
