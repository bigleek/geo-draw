import "bootstrap/dist/css/bootstrap.min.css";
import { Navbar, Container, Button, Form, Row, Col, Alert, InputGroup, Dropdown } from "react-bootstrap";
import { MapContainer, TileLayer, FeatureGroup, LayersControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import { React, useState, useMemo, useEffect, useRef } from "react";
import examples from "./examples";
import { Twitter } from "react-bootstrap-icons";
import FullscreenControl from "./FullscreenControl";
import CRC32 from "crc-32";
import { EditControl } from "react-leaflet-draw";
import ReactGA from "react-ga4";
import { transformInput, ValueError, getBbox, layerGroupToWkt } from "./wkt";
import toast, { Toaster } from "react-hot-toast";
import wellknown from "wellknown";

const DEFAULT_EPSG = "4326";

const formats = {
  "wkt": "WKT",
  "wkb": "WKB",
  "ewkb": "EWKB",
  "bbox": "BBOX",
  "geojson": "GeoJSON"
};

function createCircleMarker(feature, latlng) {
  let options = {
    radius: 4
  }
  return L.circleMarker(latlng, options);
}

// 在文件开头的 state 声明部分添加
function App() {
  const [map, setMap] = useState(null);
  const [error, setError] = useState(null);
  const [epsg, setEpsg] = useState("");
  const [wkt, setWkt] = useState("");
  const [wkb, setWkb] = useState("");
  const [ewkb, setEwkb] = useState("");
  const [json, setJson] = useState("");
  const [bbox, setBbox] = useState("");  // 添加 bbox state
  const [exampleIndex, setExampleIndex] = useState(0);

  const groupRef = useRef();

  const ensureResize = function (mapRef) {
    const resizeObserver = new ResizeObserver(() => {
      mapRef.invalidateSize();
    });
    const container = document.getElementById("map");
    if (container) {
      resizeObserver.observe(container);
    }
  }

  const displayMap = useMemo(
    () => {
      return <MapContainer
        id="map"
        whenReady={(mapRef) => ensureResize(mapRef.target)}
        center={[10, 0]}
        zoom={1}
        scrollWheelZoom={true}
        ref={setMap}
      >
        <LayersControl>
          <LayersControl.BaseLayer checked name="OpenStreetMap">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Humanitarian">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
              url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Esri World Imagery">
            <TileLayer
              attribution='Esri, Maxar, Earthstar Geographics, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
          <LayersControl.Overlay name="OpenSeaMap">
            <TileLayer
              attribution='&copy; <a href="http://www.openseamap.org">OpenSeaMap contributors</a>'
              url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
            />
          </LayersControl.Overlay>
        </LayersControl>
        <FullscreenControl />
        <FeatureGroup ref={groupRef}>
          <EditControl
            position="topright"
            onDrawStop={handleDrawStop}
            edit={{ edit: false, remove: false }}
            draw={{
              rectangle: {
                shapeOptions: {
                  opacity: 1,
                  fillOpacity: 0.2,
                  weight: 3,
                  color: "#3388ff",
                  fill: "#3388ff"
                }
              },
              marker: false,
              circle: false,
              polygon: {
                shapeOptions: {
                  opacity: 1,
                  fillOpacity: 0.2,
                  weight: 3,
                  color: "#3388ff",
                  fill: "#3388ff"
                }
              },
              circlemarker: {
                opacity: 1,
                fillOpacity: 0.2,
                weight: 3,
                radius: 4,
                color: "#3388ff",
                fill: "#3388ff"
              },
              polyline: {
                shapeOptions: {
                  opacity: 1,
                  weight: 3,
                  color: "#3388ff",
                  fill: false
                }
              }
            }}
          />
        </FeatureGroup>
      </MapContainer>
    }, [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    async function fetchWkt(hash) {
      const res = await fetch("https://xpjpbiqaa3.execute-api.us-east-1.amazonaws.com/prod/wkt/" + hash);
      if (res.status === 200) {
        const data = await res.json();
        let paramWkt = data.wkt ? data.wkt : "";
        let paramEpsg = data.epsg ? data.epsg : DEFAULT_EPSG;
        setWkt(paramWkt);
        setEpsg(paramEpsg);
        processInput({
          wkt: paramWkt,
          epsg: paramEpsg
        });
      }
    }
    const urlSearchParams = new URLSearchParams(window.location.search);
    const params = Object.fromEntries(urlSearchParams.entries());
    if (Object.keys(params).length === 0) {
      loadExample();
    } else {
      const hash = Object.keys(params)[0];
      fetchWkt(hash);
    }
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDrawStop() {
    const wktDraw = layerGroupToWkt(groupRef.current);
    setEpsg(4326);
    clearHash();
    if (wktDraw) {
      setWkt(wktDraw);
      processInput({
        epsg: 4326,
        wkt: wktDraw
      }, false);
    }
  }

  function handleCopy(format) {
    if (!error) {
      let text = "";
      if (format === "wkt") {
        text = wkt;
      } else if (format === "wkb") {
        text = wkb;
      } else if (format === "ewkb") {
        text = ewkb;
      } else if (format === "geojson") {
        text = json;
      } else if (format === "bbox") {
        text = getBbox(wkt);
      }
      navigator.clipboard.writeText(text);
      toast("Copied geometry as " + formats[format], { icon: "📎" })
    }
  }

  function handleWktClear() {
    clearHash();
    setWkt("");
    processInput({
      epsg: epsg,
      wkt: ""
    });
  }

  function trimWkt(wkt) {
    return wkt.replace(/\s+/g, " ").trim();
  }

  function handleWktChange(e) {
    clearHash();
    const wkt = trimWkt(e.target.value)
    setWkt(wkt);
    processInput({
      wkt: wkt,
      epsg: epsg
    });
  }

  function handleEpsgChange(e) {
    clearHash();
    setEpsg(e.target.value);
    processInput({
      wkt: wkt,
      epsg: e.target.value
    });
  }

  function handleShare() {
    let crc = CRC32.str(wkt + epsg);
    let hash = (crc >>> 0).toString(16).padStart(8, "0");
    fetch("https://xpjpbiqaa3.execute-api.us-east-1.amazonaws.com/prod/wkt", {
      method: "POST",
      body: JSON.stringify({
        id: hash,
        wkt: wkt,
        epsg: epsg
      }),
      headers: {
        "Content-Type": "application/json"
      }
    }).catch(error => console.error(error));
    window.history.replaceState(null, null, "?" + hash);
    navigator.clipboard.writeText(window.location.href);
    toast("Generated URL for sharing and copied to clipboard")
    ReactGA.event({
      category: "wkt",
      action: "wkt_share",
      label: hash,
    });
  }

  function loadExample() {
    clearHash();
    const example = examples[exampleIndex];
    setWkt(example[0]);
    setEpsg(example[1]);
    processInput({
      wkt: example[0],
      epsg: example[1]
    });
    const newIndex = exampleIndex < examples.length - 1 ? exampleIndex + 1 : 0;
    setExampleIndex(newIndex);
  }

  // 修改 processInput 函数，添加 bbox 的更新
  async function processInput(input, doVisualize = true) {
    setError(null);
    try {
      input = await transformInput(input);
      if (input.wkt) {
        setBbox(getBbox(input.wkt));  // 更新 bbox
      }
    } catch (error) {
      if (error instanceof ValueError) {
        setError(error.message);
      }
    }
    setWkt(input.wkt);
    setEpsg(input.epsg);
    setWkb(input.wkb);
    setEwkb(input.ewkb);
    // setJson(input.json ? JSON.stringify(input.json, null, 2) : null);
    setJson(input.json ? JSON.stringify(input.json, null, 2) : "");  // 确保永远不会设置为 null
    if (doVisualize) {
      visualize(input);
    }
  }

  function clearHash() {
    const url = new URL(window.location);
    url.search = "";
    window.history.replaceState(null, null, url);
  }

  async function visualize(spatial) {
    groupRef.current.clearLayers();
    if (spatial.json) {
      const conf = {
        pointToLayer: createCircleMarker,
      };
      let newLayer = L.geoJSON(spatial.json, conf).addTo(groupRef.current);
      if (map) map.flyToBounds(newLayer.getBounds(), { duration: 0.5, maxZoom: 14 });
    }
  }

  function handleGeoJsonChange(e) {
    clearHash();
    try {
      const geoJsonInput = JSON.parse(e.target.value);
      setJson(JSON.stringify(geoJsonInput, null, 2));
      debugger
      // 提取 EPSG 代码
      let tempepsg = epsg;
      if (geoJsonInput.crs && geoJsonInput.crs.type === "name") {
        const name = geoJsonInput.crs.properties.name;
        const match = name.match(/EPSG::(\d+)/);
        if (match) {
          tempepsg = match[1]; // 提取数字部分，例如 "4326"
        }
      }
      // 生成 WKT
      const geometry = getGeometry(geoJsonInput);
      let tempwkt = "";
      if (geometry) {
        tempwkt = wellknown.stringify(geometry); // 将几何对象转换为 WKT
      }
      // 更新 WKT 和其他格式
      processInput({
        json: geoJsonInput,
        epsg: tempepsg,
        wkt: tempwkt,
        wkb: wkb,
        ewkb: ewkb
      });  // 移除 .then() 链，直接使用 processInput
    } catch (e) {
      setError("Invalid GeoJSON format");
    }
  }

function handleBboxChange(e) {
  clearHash();
  try {
    // Parse bbox from input (expected format: [minx, miny, maxx, maxy])
    const bbox = e.target.value.split(",");
    const minx = bbox[0];
    const miny = bbox[1];
    const maxx = bbox[2];
    const maxy = bbox[3];

    // Create polygon geometry from bbox
    const polygon = {
      type: "Polygon",
      coordinates: [[
        [minx, miny],
        [maxx, miny],
        [maxx, maxy],
        [minx, maxy],
        [minx, miny]
      ]]
    };

    // Create new GeoJSON feature with polygon geometry
    const newGeoJson = {
      type: "Feature",
      geometry: polygon,
      properties: {},
      crs: {
        type: "name",
        properties: {
          name: "urn:ogc:def:crs:EPSG::4326"
        }
      }
    };

    // Set JSON string representation
    setJson(JSON.stringify(newGeoJson, null, 2));

    // Generate WKT from geometry
    const tempwkt = wellknown.stringify(polygon);

    // Generate WKB and EWKB (assuming toWKB and toEWKB functions exist)
    const tempwkb = toWKB(polygon, "4326");
    const tempewkb = toEWKB(polygon, "4326");

    // Update state with new GeoJSON, WKT, WKB, and EPSG
    processInput({
      json: newGeoJson,
      epsg: "4326",
      wkt: tempwkt,
      wkb: tempwkb,
      ewkb: tempewkb
    });
  } catch (e) {
    setError("Invalid GeoJSON format");
  }
}

  // 辅助函数：从 GeoJSON 中提取几何对象
  function getGeometry(geoJson) {
    if (geoJson.type === "FeatureCollection" && geoJson.features.length > 0) {
      return geoJson.features[0].geometry;
    } else if (geoJson.type === "Feature") {
      return geoJson.geometry;
    } else if (["Point", "LineString", "Polygon", "MultiPoint", "MultiLineString", "MultiPolygon", "GeometryCollection"].includes(geoJson.type)) {
      return geoJson;
    }
    return null;
  }
  return (
    <div id="app">

      <Toaster position="top-right" toastOptions={{ duration: 5000 }} />

      <Navbar bg="light" expand="lg">
        <Container>
          <Navbar.Brand href="/">
            Well-known Text (WKT) visualization
          </Navbar.Brand>
        </Container>
      </Navbar>

      {displayMap}

      <Container className="mt-3 mb-3">

        <Row>
          <Col lg={true} className="mb-3">
            <Form.Group className="mb-3" controlId="wkt">
              <Form.Label>WKT</Form.Label>
              <Form.Control className="font-monospace" as="textarea" rows={8} value={wkt} onChange={handleWktChange} />
            </Form.Group>
            <div className="d-flex d-md-block justify-content-between">
              <Button className="me-2" variant="light" onClick={loadExample}>Load example</Button>
              <Button className="me-2" variant="warning" onClick={handleWktClear}>Clear</Button>
              <Dropdown className="me-2 d-inline-block">
                <Dropdown.Toggle variant="light">Copy as</Dropdown.Toggle>
                <Dropdown.Menu>
                  {
                    Object.keys(formats).map(format => <Dropdown.Item key={format} disabled={error || !json} onClick={() => handleCopy(format)}>{formats[format]}</Dropdown.Item>)
                  }
                </Dropdown.Menu>
              </Dropdown>
              <Button className="me-2" variant="success" onClick={handleShare}>Share</Button>
            </div>
          </Col>
          <Col lg={true} className="mb-3">
            <Form.Group className="mb-3" controlId="geojson">
              <Form.Label>GeoJSON</Form.Label>
              <Form.Control
                className="font-monospace"
                as="textarea"
                rows={8}
                value={json}
                onChange={handleGeoJsonChange}
                placeholder='{"type": "Feature", ...}'
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="bbox">
              <Form.Label>BBOX</Form.Label>
              <Form.Control
                className="font-monospace"
                type="text"
                value={bbox}
                onChange={handleBboxChange}
                placeholder="minX,minY,maxX,maxY"
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="epsg">
              <Form.Label>EPSG</Form.Label>
              <InputGroup>
                <InputGroup.Text id="basic-addon1">EPSG:</InputGroup.Text>
                <Form.Control value={epsg} onChange={handleEpsgChange} />
              </InputGroup>
            </Form.Group>
            {error && <Alert variant="danger">{error}</Alert>}
          </Col>
        </Row>
      </Container>

      <footer className="footer mt-auto pt-5 pb-4 bg-light">
        <Container>
          <p className="text-muted">This page parses, visualizes, and shares <a href="https://en.wikipedia.org/wiki/Well-known_text_representation_of_geometry" rel="noreferrer" className="text-muted" target="_blank">WKT</a> (ISO 13249) as well as <a href="https://opengeospatial.github.io/ogc-geosparql/geosparql11/spec.html#_rdfs_datatype_geowktliteral" target="blank" rel="noreferrer" className="text-muted">geo:wktLiteral</a> strings in a variety of coordinate reference systems. Built with <a href="https://openlayers.org/" target="blank" rel="noreferrer" className="text-muted">OpenLayers</a>, <a href="https://leafletjs.com/" target="blank" rel="noreferrer" className="text-muted">Leaflet</a>, <a href="https://trac.osgeo.org/proj4js" target="blank" rel="noreferrer" className="text-muted">Proj4js</a>, <a href="https://github.com/terraformer-js/terraformer" target="blank" rel="noreferrer" className="text-muted">terraformer</a>, and <a href="https://epsg.io/" target="blank" rel="noreferrer" className="text-muted">epsg.io</a>. Use the drawing tools to create your own geometries. Copy as Well-known Binary (WKB) or Extended Well-known Binary (EWKB). Also supports <a href="https://h3geo.org/" rel="noreferrer" className="text-muted" target="_blank">Uber H3</a>, <a href="https://en.wikipedia.org/wiki/Geohash" rel="noreferrer" className="text-muted" target="_blank">Geohash</a>, <a href="https://learn.microsoft.com/en-us/bingmaps/articles/bing-maps-tile-system" rel="noreferrer" className="text-muted" target="_blank">Quadkey</a>, WKB, and WFS BBOX conversion to WKT.</p>
          <p className="text-muted">Created by <Twitter className="mb-1" /> <a rel="noreferrer" className="text-muted" href="https://twitter.com/PieterPrvst" target="_blank">PieterPrvst</a></p>
        </Container>
      </footer>

    </div>
  );
}

export default App;
