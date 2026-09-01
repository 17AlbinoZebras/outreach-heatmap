'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GeoJsonObject } from 'geojson';

import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap, useMapEvent } from 'react-leaflet'
import L from 'leaflet'

import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';

import MarkerClusterGroup from "react-leaflet-markercluster";
import './L.colorIcon.js';

import 'leaflet/dist/leaflet.css';
import 'react-leaflet-markercluster/styles'

import styles from './styles/map.module.css'
import { Model, Location, Individual, Doctor, Hospital, RegionsInterface } from './model';
import { populationsInterface, countsInterface } from './model';

import starIcon from 'public/markericons/star.png'
import { valuesInterface, ZOOM_LEVEL_COUNTY, ZOOM_LEVEL_ZIP } from './home_functions';
import { AppStateTypes } from './page.js';
import { sortDoctorsAlphabetically, sortDoctorsByReferrals } from './hospitalMetrics';
import { RankingsResultsModeSelector } from './boundary.js';


// console.log(L.Icon.Default.prototype)

let hospitalIcon = L.colorIcon({
        iconUrl: 'markericons/pin.svg',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        shadowSize: [41, 41],
        iconAnchor: [12, 41],
        shadowAnchor: [-8, 0],
        popupAnchor: [-12, -50],
        color: '#999'
    })
let referringHospitalIcon = L.colorIcon({
    iconUrl: 'markericons/pin.svg',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    shadowSize: [41, 41],
    iconAnchor: [12, 41],
    shadowAnchor: [-8, 0],
    popupAnchor: [-12, -50],
    color: "#db8844"
})
// I would like to replace this image at some point
let hereIcon = L.colorIcon({
    iconUrl: 'markericons/star.svg',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [41, 41],
    shadowSize: [41, 41],
    iconAnchor: [23, 41],
    shadowAnchor: [-8, -2],
    popupAnchor: [-23, -52],
    color: "#ebce50"
})

// Tracks the map center in React state after each pan.
// This preserves the viewport when the map container re-mounts due to activeGroup changes.
function MapStateController( { setMapCenter }: { setMapCenter: ((v: [number, number]) => void) } ) {
  useMapEvent('moveend', (e) => {
    const map = e.target;
    const center = map.getCenter();
    // Save the exact center coordinates when the user finishes dragging
    setMapCenter([center.lat, center.lng]);
  });
  
  return null;
}

export function HeatMap( {model, appState}: {model: Model, appState: AppStateTypes} ) {
    const zoom = appState.zoom
    const activeGroup = appState.activeGroup
    const cancerType = appState.cancerType
    const stateData = appState.stateData
    const countyData = appState.countyData
    const zipData = appState.zipData
    const perCapita = appState.perCapita
    const adjustForCancer = appState.adjustForCancer
    const adjustForReferrals = appState.adjustForReferrals
    const dateRange = appState.dateRange
    const showLongitudinalAnalysis = appState.showLongitudinalAnalysis
    const longAnalysisPeriod1 = appState.longAnalysisPeriod1
    const longAnalysisPeriod2 = appState.longAnalysisPeriod2
    
    const here = model.getThisHospital()

    const [mapCenter, setMapCenter] = useState<[number, number]>([27.75, -82.5]);
    
    // const populations: populationsInterface = model.getPopulations()
    // const counts: countsInterface = model.getCounts()
    // let cancerCount = counts.byCounty.cancer.protonEligible.get(cancerType)

    return (
        <div className='map, markercluster-map'>
            <MapContainer key={activeGroup} center={mapCenter} zoom={zoom} scrollWheelZoom={false} style={{ height: "100vh", width: "100%", margin: "0" }}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png?key=cb1_2r6n_1_781b6adbcb6855d69cbbd6a2"
                />
                {countyData && stateData && (
                    <ZoomAwareGeoJSON key={`${activeGroup}-${perCapita}-${adjustForCancer}-${adjustForReferrals}-${dateRange.start}-${dateRange.end}-${showLongitudinalAnalysis}-${longAnalysisPeriod1}-${longAnalysisPeriod2}`} model={model} appState={appState} />
                )}
                {/* {(activeGroup === 'doctor') && < HospitalMarkers model={model} appState={appState} />} */}
                <Marker icon={hereIcon} position={here.getCoords()}>
                    <Popup>
                        Hospital <br/>
                        {here.getFacilityName()} <br/>
                        {here.getCounty()} <br/>
                    </Popup>
                </Marker>
                {/* <div className={styles.patientMarkers}>
                    {model.patients.map((patient: Individual, index: number) => (
                        <Marker key={"p" + index} icon={patientIcon} position={patient.getAddress().getCoords()}>
                            <Popup>
                                Patient<br/>
                                {patient.getAddress().getCityOrTownship()}
                            </Popup>
                        </Marker>
                    ))}
                </div> */}
                < MapStateController setMapCenter={setMapCenter} />
            </MapContainer>
        </div>
    )
}

// Main choropleth rendering component. Switches between state/county/zip GeoJSON layers
// based on zoom level, applies choropleth fill colors, binds popups and count labels,
// and manages hover/click/selection highlight state via Leaflet refs.
function ZoomAwareGeoJSON( {model, appState}: {model: Model, appState: AppStateTypes} ) {
    const map = useMap();

    // const [zoom, setZoom] = useState(map.getZoom());
    const zoom = appState.zoom
    const setZoom = appState.setZoom

    useEffect(() => {
        const onZoom = () => setZoom(map.getZoom());
        map.on('zoomend', onZoom);
        return () => { map.off('zoomend', onZoom); };
    }, [map]);

    const activeGroup = appState.activeGroup
    const cancerType = appState.cancerType

    const stateData = appState.stateData
    const countyData = appState.countyData
    const zipData = appState.zipData

    const perCapita = appState.perCapita
    const longitudinalAnalysis = appState.showLongitudinalAnalysis
    
    const isZip = zoom >= ZOOM_LEVEL_ZIP;
    const isCounty = (zoom >= ZOOM_LEVEL_COUNTY) && (zoom < ZOOM_LEVEL_ZIP);

    const rankingsResultsMode = appState.rankingsResultsMode
    const topRankings = appState.rankings.topRankings
    const worstRankings = appState.rankings.worstRankings
    const { topRankingNames, bottomRankingNames } = useMemo(() => {
        if (rankingsResultsMode === 'doctors') {
            const toMapKey = (loc: string | undefined) =>
                loc ? (isCounty ? 'FL' + loc : loc) : undefined;
            return {
                topRankingNames: new Set(topRankings.map(r => toMapKey(r.location)).filter((k): k is string => k !== undefined)),
                bottomRankingNames: new Set(worstRankings.map(r => toMapKey(r.location)).filter((k): k is string => k !== undefined)),
            };
        }
        return {
            topRankingNames: new Set(topRankings.map(r => r.name)),
            bottomRankingNames: new Set(worstRankings.map(r => r.name)),
        };
    }, [topRankings, worstRankings, activeGroup, isCounty]);

    const populations: populationsInterface = model.getPopulations()
    const counts: countsInterface = model.getCounts()
    const cancerRates = model.getCancerRates().allCancerCases.get(cancerType)

    const activeCounts = appState.activeCounts
    const stateCounts = activeGroup === 'doctor' ? counts.byState.doctor : counts.byState.patient
    const countyCounts = activeGroup === 'doctor' ? counts.byCounty.doctor : (activeGroup === 'cancer' && cancerRates ? cancerRates : counts.byCounty.patient)
    const zipCounts = activeGroup === 'doctor' ? counts.byZip.doctor : counts.byZip.patient

    const data = isZip ? zipData : isCounty ? countyData : stateData;
    const activeCount = isZip ? activeCounts.byZip : isCounty ? activeCounts.byCounty : activeCounts.byState;
    // const activeCount = isZip ? zipCounts : isCounty ? countyCounts : stateCounts;
    const activePopulations = isZip ? populations.byZip : isCounty ? populations.byCounty : populations.byState
    const displayValues: valuesInterface = appState.displayValues
    const displayVals: Map<string, number> = isZip ? displayValues.byZip : isCounty ? displayValues.byCounty : displayValues.byState;
    
    const getColors: RegionsInterface<(value: number) => string> = appState.getColors
    const getColor = isZip ? getColors.byZip : isCounty ? getColors.byCounty : getColors.byState

    const docsByLocation = appState.doctorsByRegion
    const doctorsByRegion = isZip ? docsByLocation.byZip : isCounty ? docsByLocation.byCounty : docsByLocation.byState

    const period1ActiveCounts = appState.period1ActiveCounts
    const period2ActiveCounts = appState.period2ActiveCounts

    const selectedRegion = appState.selectedRegion
    const setSelectedRegion = appState.setSelectedRegion

    const displayGroup = activeGroup === 'doctor' ? ' Doctors' : activeGroup === 'referral' ? ' Referrals' : ' Patients'
    const displayUnits = longitudinalAnalysis ? "%" : perCapita ? " per 100k" : displayGroup

    // Control tooltip visibility via CSS — avoids react-leaflet lifecycle timing issues
    const updateTooltipVisibility = () => {
        const z = map.getZoom();
        const show = (z > ZOOM_LEVEL_COUNTY && z < ZOOM_LEVEL_ZIP) || z >= ZOOM_LEVEL_ZIP + 2;
        document.querySelectorAll<HTMLElement>(`.${styles.regionLabels}`).forEach(el => {
            el.style.visibility = show ? 'visible' : 'hidden';
        });
    };

    // Handle zoom changes
    useEffect(() => {
        map.on('zoomend', updateTooltipVisibility);
        return () => { map.off('zoomend', updateTooltipVisibility); };
    }, [map]);

    // Re-apply visibility after GeoJSON remounts — defer so Leaflet has time to add new tooltip elements
    useEffect(() => {
        const timer = setTimeout(updateTooltipVisibility, 0);
        return () => clearTimeout(timer);
    }, [isZip, isCounty]);

    // Change style for the selected region
    useEffect(() => {
        if (!selectedRegion || !geoJsonRef.current) return;
        geoJsonRef.current.eachLayer(layer => {
            const feature = (layer as any).feature;
            const stateName = feature?.properties?.['stusps'];
            const countyName = feature?.properties?.['namelsad'];
            const zipName = feature?.properties?.['ZCTA5CE10'];
            const getter = isZip ? zipName : isCounty ? stateName + countyName : stateName;
            if (getter === selectedRegion) {
                selectedLayerRef.current = layer;
                (layer as L.Path).setStyle({ weight: 2, color: '#000', fillOpacity: 0.8 });
            }
        });
    }, [isZip, isCounty, selectedRegion]);

    // console.log('rates:', [...activeCount.entries()].map(([name, count]) => {
    // const pop = activePopulations.get(name) ?? 0;
    // return pop > 0 ? (count / pop) * 100000 : 0;
    // }).sort((a, b) => b - a).slice(0, 10));

    const geoJsonRef = useRef<L.GeoJSON | null>(null);
    const hoveredRef = useRef<L.Layer | null>(null);
    const selectedLayerRef = useRef<L.Layer | null>(null);
    const justClickedFeature = useRef(false);

    // Deselect the active region when the user clicks on the map background (not on a feature)
    useMapEvent('click', () => {
        if (justClickedFeature.current) {
            justClickedFeature.current = false;
            return;
        }
        if (selectedLayerRef.current) {
            geoJsonRef.current?.resetStyle(selectedLayerRef.current);
            selectedLayerRef.current = null;
            setTimeout(() => appState.setSelectedRegion(null), 0);
        }
    });

    // Stable reference: react-leaflet calls layer.setStyle() across ALL features whenever
    // this function changes. Keep it stable so only real data changes trigger re-styling.
    const styleCallback = useCallback((feature: any) => {
        const stateName = feature?.properties?.['stusps']
        const countyName = feature?.properties?.['namelsad']
        const zipName = feature?.properties?.['ZCTA5CE10']
        const name = isZip ? zipName : isCounty ? "FL" + countyName : stateName
        const getter = isZip ? zipName : isCounty ? stateName + countyName : stateName

        const displayVal = displayVals.get(getter);
        const displayCount = displayVal ? (perCapita ? Math.round(displayVal * 10) / 10 : Math.round(displayVal) ?? 0) : undefined;

        const isTopRegion = displayCount && topRankingNames.has(name);

        return {
            color: isTopRegion ? '#2ea043' : '#666',
            weight: isTopRegion ? 2 : 1,
            fillColor: displayCount ? getColor(displayCount) : '#ffffff',
            fillOpacity: displayCount ? 0.6 : 0.05,
        };
    }, [isZip, isCounty, displayVals, perCapita, getColor, topRankingNames]);

  return (
    <div>
        <GeoJSON
            ref={geoJsonRef}
            key={`${activeGroup}-${isZip ? 'zip' : isCounty ? 'county' : 'state'}`}
            data={data as GeoJsonObject}
            style={styleCallback}
            onEachFeature={(feature, layer) => {
                const stateName = feature?.properties?.['stusps']
                const countyName = feature?.properties?.['namelsad']
                const zipName = feature?.properties?.['ZCTA5CE10']
                const name = isZip ? zipName : isCounty ? countyName : stateName
                const getter = isZip ? zipName : isCounty ? stateName + countyName : stateName

                const count = Math.round(activeCount.get(getter) ?? 0);
                const displayVal = displayVals.get(getter) ?? 0
                const displayCount = perCapita ? Math.round(displayVal * 10) / 10 : Math.round(displayVal) ?? 0;
                
                const tooltipUnits = (activeGroup === 'doctor' || activeGroup === 'patient') ? longitudinalAnalysis ? "%" : "" : ""
                
                const pop = activePopulations.get(getter) ?? 0;
                const rate = pop > 0 ? ((count / pop) * 100000).toFixed(1) : '0';
                // const expDensity = pop > 0 ? Math.round((70 / 100000) * pop) : '0';

                const regionDoctors = [...doctorsByRegion.get(getter) ?? new Map<Doctor, number>()].sort(activeGroup === 'referral' ? sortDoctorsByReferrals : sortDoctorsAlphabetically)
                let displayDoctors: string[] = []
                regionDoctors?.forEach(([doctor, numReferrals]) => {
                    if (!isNaN(numReferrals)) {
                        const displayPrefix = longitudinalAnalysis ? ((numReferrals > 0) ? "+" : "") : ""
                        if ((activeGroup != 'referral') || numReferrals) {
                            const displayDoc = '<li>' + doctor.getName() + (activeGroup === 'referral' ? ": " + displayPrefix + numReferrals + displayUnits : '') + '</li>'
                            displayDoctors.push(displayDoc)
                        }
                    }
                })

                const p1Map = isZip ? period1ActiveCounts?.byZip : isCounty ? period1ActiveCounts?.byCounty : period1ActiveCounts?.byState;
                const p2Map = isZip ? period2ActiveCounts?.byZip : isCounty ? period2ActiveCounts?.byCounty : period2ActiveCounts?.byState;
                const p1Val = p1Map?.get(getter);
                const p2Val = p2Map?.get(getter);

                // TO-DO: only show x # of doctors at a time
                layer.bindPopup(
                    (`<strong>${name}</strong><br/>` +
                    `Count: ${displayCount}${displayUnits}<br/>` +
                    `Population: ${pop.toLocaleString()}<br/>` +
                    `Rate: ${rate} per 100k<br/>` +
                    (longitudinalAnalysis ? (() => {
                        const unitFor = (n: number) => {
                            const abs = Math.abs(n);
                            if (activeGroup === 'patient') return abs === 1 ? 'patient' : 'patients';
                            if (activeGroup === 'referral') return abs === 1 ? 'referral' : 'referrals';
                            return abs === 1 ? 'referrer' : 'referrers';
                        };
                        const p1 = p1Val !== undefined ? Math.round(p1Val) : 0;
                        const p2 = p2Val !== undefined ? Math.round(p2Val) : 0;
                        return `<hr style="margin:4px 0"/>` +
                            `Period 1: ${p1} ${unitFor(p1)}<br/>` +
                            `Period 2: ${p2} ${unitFor(p2)}`;
                    })() : '')), //+
                    // `<hr/>Doctors:<br><ul>${displayDoctors.join('')}</ul>`),
                    {
                        className: styles.regionPopup
                    }
                );
                if (Math.abs(displayCount) > 0) {
                    layer.bindTooltip((`${displayCount}${tooltipUnits}`), {
                        permanent: true,
                        interactive: false,
                        direction: "center",
                        className: styles.regionLabels}
                    ).openTooltip();
                }

                const path = layer as L.Path;

                path.on({
                    mouseover: () => {
                        // Reset whichever layer was previously hovered
                        if (hoveredRef.current && hoveredRef.current !== layer) {
                            geoJsonRef.current?.resetStyle(hoveredRef.current);
                        }
                        
                        hoveredRef.current = layer;
                        path.setStyle({ weight: 2, color: '#333' });
                        path.bringToFront();
                    },
                    mouseout: () => {
                        if (layer === selectedLayerRef.current) {
                            path.setStyle({ weight: 3, color: '#000', fillOpacity: 0.8 });
                        } else {
                            geoJsonRef.current?.resetStyle(layer);
                        }
                        hoveredRef.current = null;
                    },
                    click: () => {
                        justClickedFeature.current = true;
                        if (selectedLayerRef.current && selectedLayerRef.current !== layer) {
                            geoJsonRef.current?.resetStyle(selectedLayerRef.current);
                        }
                        if (selectedLayerRef.current === layer) {
                            geoJsonRef.current?.resetStyle(layer);
                            selectedLayerRef.current = null;
                            // Defer state update so the deselect paint renders before React re-runs
                            setTimeout(() => appState.setSelectedRegion(null), 0);
                        } else {
                            selectedLayerRef.current = layer;
                            path.setStyle({ weight: 3, color: '#000', fillOpacity: 0.8 });
                            path.bringToFront();
                            // Defer state update so the popup and highlight paint before React re-renders
                            setTimeout(() => appState.setSelectedRegion(getter), 0);
                        }
                    }
                });
            }}
        />
        {isZip && countyData && (
            <GeoJSON
                key="county-outline"
                data={countyData}
                style={() => ({
                weight: 2,
                color: '#666',
                fill: false,        // no fill, just the border
                interactive: false, // don't capture mouse events
                })}
            />
        )}
    </div>
  );
}


// ─── Unused / inactive (call site is commented out) ────────────────────────────

function HospitalMarkers({model, appState}: {model: Model, appState: AppStateTypes}) {
    const here = model.getThisHospital()

    return (
        <div className={styles.hospitalMarkers}>
            < MarkerClusterGroup >
                {model.hospitals.map((hospital: Hospital) => {
                    if (hospital.getId() === here.getId()) {
                        return
                    }
                    return (
                    <Marker key={"h" + hospital.getId()} icon={hospital.getNumReferrals() > 0 ? referringHospitalIcon : hospitalIcon} position={hospital.getCoords()}>
                        <Popup>
                            {hospital.getFacilityName()} <br/>
                            {hospital.getCounty()} <br/>
                            # Doctors: {hospital.getDoctors().length} <br/>
                            # Referrals: {hospital.getNumReferrals()}
                        </Popup>
                    </Marker>
                )})}
            </MarkerClusterGroup>
        </div>
    )
}