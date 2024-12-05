"use client";
import { Checkbox, MantineProvider } from "@mantine/core";
import React, { useEffect, useState, useRef } from "react";
import Nav from "@/components/Nav";
import CouncilDist from "./data/CouncilDistricts.json";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mantine/core/styles.css";
import { computeclosestcoordsfromevent } from "@/components/getclosestcoordsfromevent";
import geoData from "./data/output.json";
const optionsCd = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5" },
  { value: "6", label: "6" },
  { value: "7", label: "7" },
  { value: "8", label: "8" },
  { value: "9", label: "9" },
  { value: "10", label: "10" },
  { value: "11", label: "11" },
  { value: "12", label: "12" },
  { value: "13", label: "13" },
  { value: "14", label: "14" },
  { value: "15", label: "15" },
];

const Home = () => {
  const cdValues = optionsCd.map((entry) => entry.value);
  const [filteredCD, setFilteredCD] = useState(cdValues);
  const [filterpanelopened, setfilterpanelopened] = useState(true);
  const [selectedfilteropened, setselectedfilteropened] = useState("cd");
  const [selectAll, setSelectAll] = useState(false);
  const mapref = useRef(null);
  const divRef = useRef(null);

  useEffect(() => {
    mapboxgl.accessToken = "pk.eyJ1Ijoia2VubmV0aG1lamlhIiwiYSI6ImNseGV6b3c0djAyOGYyc3B3a3Bzd2xtNXEifQ.iNXcgdwigbqLTpSYbMJUOg";

    const mapparams = {
      container: divRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-118.41, 34],
      zoom: 10,
    };

    const map = new mapboxgl.Map(mapparams);
    mapref.current = map;

    const geoJsonData = {
      type: "FeatureCollection",
      features: geoData?.features,
    };
    const counsilDistFeatures = CouncilDist.features.map((feature) => ({
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
    }));
    const CouncilDistData = {
      type: "FeatureCollection",
      features: counsilDistFeatures,
    };

    map.on("load", () => {
      map.addSource("hydration-source", {
        type: "geojson",
        data: geoJsonData,
      });

      map.addSource("cd-boundaries-source", {
        type: "geojson",
        data: CouncilDistData,
      });

      let popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
      });

      map.addLayer({
        id: "cd-boundaries",
        type: "line",
        source: "cd-boundaries-source",
        paint: {
          "line-color": "white",
          "line-width": 1,
        },
        layout: {},
      });

      map.addLayer({
        id: "hydration",
        type: "heatmap",
        source: "hydration-source",
        minzoom: 5,
        layout: {},
        paint: {
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(0, 0, 255, 0)",
            0.1,
            "royalblue",
            0.3,
            "cyan",
            0.67,
            "hsl(60, 100%, 50%)",
            1,
            "rgb(255, 0, 0)",
          ],
          "heatmap-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            0.6,
            12.11,
            0.7,
            15,
            0.8,
            22,
            1,
          ],
          "heatmap-radius": [
            "interpolate",
            ["cubic-bezier", 1, 1, 1, 1],
            ["zoom"],
            0,
            3,
            10,
            8,
            11.59,
            11,
            13.7,
            20,
            16.02,
            35,
            16.76,
            58,
            22,
            100,
          ],
          "heatmap-weight": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            0.1,
            7,
            0.3,
            10.07,
            0.5,
            12.75,
            0.7,
            16,
            0.9,
            22,
            1.3,
          ],
          "heatmap-intensity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            0.5,
            7.74,
            0.6,
            9.17,
            0.7,
            11.55,
            0.8,
            12.75,
            0.9,
            16.19,
            1,
            22,
            1,
          ],
        },
      });
      const handleMouseMove = (e) => {
        if (e.features && e.features.length > 0) {
          map.getCanvas().style.cursor = "pointer";
          const closestCoords = computeclosestcoordsfromevent(e);
          const filteredFeatures = e.features.filter((feature) => {
            const geometry = feature?.geometry;
            if (geometry?.type === "Point" && "coordinates" in geometry) {
              const coordinates = geometry.coordinates;
              return (
                coordinates[0] === closestCoords[0] &&
                coordinates[1] === closestCoords[1]
              );
            }
            return false;
          });
          const coordinates = closestCoords.slice();
          while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
          }

          if (filteredFeatures.length > 0) {
            const allLineItems = filteredFeatures.map((item) => {
              const Name = item.properties["Name"] || "";
              const Address = item.properties["Address"] || "";
              const HydrationStationStatus = item.properties["Hydration Station Status"] || "";
              const NoofHydrationStations = item.properties["No. of Hydration Stations"] || "";
              const NoofWaterFountains = item.properties["No. of Water Fountains"] || "";
              const NoofRestrooms = item.properties["No. of Restrooms"] || "";
              const NoofSinks = item.properties["No. of Sinks"];
              const NoofToilets = item.properties["No. of Toilets"];
              const NoofUrinals = item.properties["No. of Urinals"];

              return `<div>
                  <p><strong>Name:</strong> ${Name}</p>
                  <p><strong>Address:</strong> ${Address}</p>
                  <p><strong>HydrationStationStatus:</strong> ${HydrationStationStatus}</p>
                  <p><strong>NoofHydrationStations:</strong> ${NoofHydrationStations}</p>
                  <p><strong>NoofWaterFountains:</strong> ${NoofWaterFountains}</p>
                  <p><strong>NoofRestrooms:</strong> ${NoofRestrooms}</p>
                  <p><strong>NoofSinks:</strong> ${NoofSinks}</p>
                  <p><strong>NoofToilets:</strong> ${NoofToilets}</p>
                  <p><strong>NoofUrinals:</strong> ${NoofUrinals}</p>
                </div>`;
            });

            popup
              .setLngLat(coordinates)
              .setHTML(
                `
                <div style="width: 300px;">
                <div>
                ${allLineItems.join(" ")}
                    </div>
                </div>
                <style>
                  .mapboxgl-popup-content {
                    background: #212121e0;
                    color: #ffffff;
                  }
                </style>`
              )
              .addTo(map);
          }
        }
      };

      map.on("mousemove", "hydration", handleMouseMove);

      map.on("mouseleave", "hydration", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });
    });

    return () => map.remove();
  }, [selectAll]);


  const setfilteredcouncildistrictspre = (event, type) => {
    if (event === "") {
      setSelectAll(!selectAll);
    } else if (event === "sndk") {
      setFilteredCD([]);
      mapref.current.setFilter("hydration", [
        "in",
        ["get", type],
        ["literal", event],
      ]);
    } else {
      setFilteredCD(event);
      console.log(event)
      mapref.current.setFilter("hydration", [
        "in",
        ["get", type],
        ["literal", event.map(item => parseInt(item))],
      ]);
    }
  };

  return (
    <div>
      <MantineProvider>
        <div className="flex-none">
          <Nav />
        </div>
        <div className="absolute mt-[3.5em] ml-2 md:ml-3 top-0 z-5 z-50 w-full">
          <div className="flex justify-between w-full h-10">
            <div
              className="md:ml-3 top-0 z-5 ml-2 text-base bold md:semi-bold break-words bg-[#212121] p-3"
              style={{
                backgroundColor: "#212121",
                color: "#ffffff",
              }}
            >
              <strong className="">Hydration</strong>
            </div>
            <div className={`geocoder mr-4 ml-1 xs:text-sm sm:text-base md:text-lg`} id="geocoder"></div>
          </div>
          <button
            onClick={() => setfilterpanelopened(!filterpanelopened)}
            className="mt-2 rounded-full px-3 pb-1.5 pt-0.5 text-sm bold md:text-base bg-gray-800 bg-opacity-80 text-white border-white border-2"
          >
            <svg
              style={{
                width: "20px",
                height: "20px",
              }}
              viewBox="0 0 24 24"
              className="inline align-middle mt-0.5"
            >
              <path
                fill="currentColor"
                d="M14,12V19.88C14.04,20.18 13.94,20.5 13.71,20.71C13.32,21.1 12.69,21.1 12.3,20.71L10.29,18.7C10.06,18.47 9.96,18.16 10,17.87V12H9.97L4.21,4.62C3.87,4.19 3.95,3.56 4.38,3.22C4.57,3.08 4.78,3 5,3V3H19V3C19.22,3 19.43,3.08 19.62,3.22C20.05,3.56 20.13,4.19 19.79,4.62L14.03,12H14Z"
              />
            </svg>
            <span>Filter</span>
          </button>
        </div>

        <div
          className={`bottom-0 sm:bottom-auto md:mt-[7.6em] md:ml-3 w-screen sm:w-auto z-50 ${filterpanelopened === true ? "absolute " : "hidden"}`}
        >
          <div className="bg-zinc-900 w-content bg-opacity-90 px-2 py-1 mt-1 sm:rounded-lg">
            <div className="gap-x-0 flex flex-row w-full">
              <button
                onClick={() => setselectedfilteropened("cd")}
                className={`px-2 border-b-2 py-1 font-semibold ${selectedfilteropened === "cd" ? "border-[#41ffca] text-[#41ffca]" : "hover:border-white border-transparent text-gray-50"}`}
              >
                CD #
              </button>
            </div>

            <div className="flex flex-col">
              {selectedfilteropened === "cd" && (
                <div className="pl-5 pr-2 py-2">
                  <button
                    className="align-middle text-white rounded-lg px-1  border border-gray-400 text-sm md:text-base"
                    onClick={() => {
                      setFilteredCD(optionsCd.map((option) => option.value));
                      setfilteredcouncildistrictspre("", "Council District");
                    }}
                  >
                    Select All
                  </button>
                  <button
                    className="align-middle text-white rounded-lg px-1  border border-gray-400 text-sm md:text-base"
                    onClick={() => {
                      setfilteredcouncildistrictspre("sndk", "Council District");
                    }}
                  >
                    Unselect All
                  </button>
                  <br />
                  <Checkbox.Group
                    value={filteredCD}
                    onChange={(event) => setfilteredcouncildistrictspre(event, "Council District")}
                  >
                    <div className={`grid grid-cols-3 gap-x-4 my-2`}>
                      {optionsCd.map((eachEntry) => (
                        <Checkbox
                          id={eachEntry.value}
                          value={eachEntry.value}
                          label={
                            <span className="text-nowrap text-xs">
                              <span className="text-white">{eachEntry.label}</span>
                            </span>
                          }
                          key={eachEntry.value}
                          className="my-2"
                        />
                      ))}
                    </div>
                  </Checkbox.Group>
                </div>
              )}
            </div>
          </div>
        </div>
        <div ref={divRef} style={{ width: "100%", height: "100vh" }} />
      </MantineProvider>

      <div className={`absolute md:mx-auto bottom-2 left-1 md:left-1/2 md:transform md:-translate-x-1/2`}>
        <a href="https://controller.lacity.gov/" target="_blank" rel="noopener noreferrer">
          <img
            src="https://controller.lacity.gov/images/KennethMejia-logo-white-elect.png"
            className="h-9 md:h-10 z-40"
            alt="Kenneth Mejia LA City Controller Logo"
          />
        </a>
      </div>
    </div>
  );
};

export default Home;

