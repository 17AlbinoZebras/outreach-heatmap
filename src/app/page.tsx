'use client'
import React, { useEffect, useMemo, useState } from 'react'

import dynamic from "next/dynamic"
import { countsInterface, doctorsByRegionInterface, Model, populationsInterface, RegionsInterface } from './model'
import { ActiveGroupButton, ColorLegend, LongitudinalRankingsResultsTypeSelector, MapFilters, RankingsResultsModeSelector, RegionRankingsRadiusSelector } from './boundary'

import '@fontsource/arimo';
import "@fontsource/roboto";
import "@fontsource/source-sans-3";

import styles from './styles/page.module.css'
import { GeoJsonObject } from 'geojson'
import { cancerTypes, COLOR_RAMPS, computeCancerRates, computeCounts, computeLongitudinalAnalysis, getDisplayValues, getDoctorThresholds, getLegends, getThresholds, makeGetColor, valuesInterface, ZOOM_LEVEL_COUNTY, ZOOM_LEVEL_ZIP } from './home_functions'
import { computeRankings, CountyAbbreviationsKey, Rankings, rankingsInterface } from './hospitalMetrics'

const HeatMap = dynamic(() => import('./map').then((module) => module.HeatMap), {
  ssr: false
})

export type activeGroupOptions = "doctor" | "patient" | "cancer" | "referral"
export type rankingsResultsModeOptions = "regions" | "doctors"


export interface AppStateTypes {
  zoom: number;
  setZoom: (v: number) => void;
  activeGroup: activeGroupOptions;
  setActiveGroup: (v: activeGroupOptions) => void;
  cancerType: string;
  setCancerType: (v: string) => void;
  perCapita: boolean;
  setPerCapita: (v: boolean) => void;
  adjustForCancer: boolean;
  setAdjustForCancer: (v: boolean) => void;
  adjustForReferrals: boolean;
  setAdjustForReferrals: (v: boolean) => void;
  radiusFromThisHospital: number;
  setRadiusFromThisHospital: (v: number) => void;
  regionRankingsRadius: number;
  setRegionRankingsRadius: (v: number) => void;
  showDateRange: boolean;
  setShowDateRange: (v: boolean) => void;
  dateRange: { start: Date | null; end: Date | null };
  setDateRange: (v: { start: Date | null; end: Date | null }) => void;
  showLongitudinalAnalysis: boolean;
  setShowLongitudinalAnalysis: (v: boolean) => void;
  longAnalysisPeriod1: { startDate: Date; endDate: Date } | null;
  setlongAnalysisPeriod1: (v: { startDate: Date; endDate: Date } | null) => void;
  longAnalysisPeriod2: { startDate: Date; endDate: Date } | null;
  setlongAnalysisPeriod2: (v: { startDate: Date; endDate: Date } | null) => void;
  rankingsResultsMode: rankingsResultsModeOptions;
  setRankingsResultsMode: (v: rankingsResultsModeOptions) => void;
  selectedRegion: string | null;
  setSelectedRegion: React.Dispatch<React.SetStateAction<string | null>>;
  period1ActiveCounts: valuesInterface | null;
  period2ActiveCounts: valuesInterface | null;

  zipData: GeoJsonObject | null;
  countyData: GeoJsonObject | null;
  stateData: GeoJsonObject | null;
  activeCounts: valuesInterface;
  displayValues: valuesInterface;
  doctorsByRegion: doctorsByRegionInterface
  rankings: rankingsInterface
  getColors: RegionsInterface<(value: number) => string>;
  legends: RegionsInterface<{color: string, label: string}[]>;
}

export default function Home() {
  const model = new Model("CityOrTownship")

  const [zoom, setZoom] = useState(7);
  const [activeGroup, setActiveGroup] = useState<activeGroupOptions>("patient");
  const [perCapita, setPerCapita] = useState(false);
  const [adjustForCancer, setAdjustForCancer] = useState(false);

  // Show # referrals instead of # doctors
  const [adjustForReferrals, setAdjustForReferrals] = useState(false);

  const [cancerType, setCancerType] = useState(cancerTypes[0]);

  const [radiusFromThisHospital, setRadiusFromThisHospital] = useState(10);
  const [regionRankingsRadius, setRegionRankingsRadius] = useState(50);

  const [showDateRange, setShowDateRange] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  const [showLongitudinalAnalysis, setShowLongitudinalAnalysis] = useState(false);
  const [longAnalysisPeriod1, setlongAnalysisPeriod1] = useState<{ startDate: Date; endDate: Date } | null>(null);
  const [longAnalysisPeriod2, setlongAnalysisPeriod2] = useState<{ startDate: Date; endDate: Date } | null>(null);

  const [rankingsResultsMode, setRankingsResultsMode] = useState<rankingsResultsModeOptions>("regions")

  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // I want to make a single useState that holds all of the user's selected options 

  const [countyData, setCountyData] = useState<GeoJsonObject | null>(null);
  const [stateData, setStateData] = useState<GeoJsonObject | null>(null);
  const [zipData, setZipData] = useState<GeoJsonObject | null>(null);

  useEffect(() => {
  fetch('./boundaries/distances/counties_dist.geojson')
      .then(res => res.json())
      .then(setCountyData);
  }, [])
  useEffect(() => {
  fetch('./boundaries/distances/states_dist.geojson')
      .then(res => res.json())
      .then(setStateData);
  }, [])
  useEffect(() => {
  fetch('./boundaries/distances/zip_codes_dist.geojson')
      .then(res => res.json())
      .then(setZipData);
  }, [])

  // Compute counts based on user-inputted dates and/or longitudinal analysis date ranges
  const originalCounts: countsInterface = model.getCounts()
  const originalDoctorsByRegion: doctorsByRegionInterface = model.getDoctorsByRegion()
  const dateFilteredCounts = useMemo(
    () => showDateRange ? computeCounts(model.getPatients(), model.getDoctors(), model.getReferrals(), dateRange.start, dateRange.end) : null,
    [dateRange, showDateRange]
  );
  const longAnalysisCounts = useMemo(
    () => showLongitudinalAnalysis ? computeLongitudinalAnalysis(model.getPatients(), model.getDoctors(), model.getReferrals(), longAnalysisPeriod1, longAnalysisPeriod2) : null, [longAnalysisPeriod1, longAnalysisPeriod2, showLongitudinalAnalysis]
  );
  const counts = (showLongitudinalAnalysis ? longAnalysisCounts?.counts : showDateRange ? dateFilteredCounts?.counts : originalCounts) ?? originalCounts;
  const doctorsByRegion = longAnalysisCounts?.doctorsByRegion ?? dateFilteredCounts?.doctorsByRegion ?? originalDoctorsByRegion;
  
  const originalCancerRates = model.getCancerRates().allCancerCases.get(cancerType) ?? new Map();
  const dateFilteredCancerRates = useMemo(
    () => computeCancerRates(model.getCancerRates().allCancerCases, model.getReferrals(), dateRange.start, dateRange.end),
    [dateRange, showDateRange]
  );
  const cancerRates = dateFilteredCancerRates?.get(cancerType) ?? originalCancerRates;
  const populations: populationsInterface = model.getPopulations()

  
  const referralCounts = useMemo<valuesInterface>(() => ({
    byState: counts.byState.referrals,
    byCounty: counts.byCounty.referrals,
    byZip: counts.byZip.referrals,
  }), [counts]);
  // Determine which group to show
  const activeCounts = useMemo<valuesInterface>(() =>
    activeGroup === 'referral' ? referralCounts
    : activeGroup === 'doctor' ? { byState: counts.byState.doctor, byCounty: counts.byCounty.doctor, byZip: counts.byZip.doctor }
    : activeGroup === 'cancer' ? { byState: cancerRates, byCounty: cancerRates, byZip: cancerRates }
    : { byState: counts.byState.patient, byCounty: counts.byCounty.patient, byZip: counts.byZip.patient },
  [activeGroup, referralCounts, counts, cancerRates]);

  // Extracts the count map matching the current active group from a raw period result.
  // Used to populate the Period 1 / Period 2 absolute values shown in map popups.
  const getActiveCountsForPeriod = (c: countsInterface | null | undefined): valuesInterface | null => {
    if (!c) return null;
    return activeGroup === 'referral' ? { byState: c.byState.referrals, byCounty: c.byCounty.referrals, byZip: c.byZip.referrals }
      : activeGroup === 'doctor' ? { byState: c.byState.doctor, byCounty: c.byCounty.doctor, byZip: c.byZip.doctor }
      : { byState: c.byState.patient, byCounty: c.byCounty.patient, byZip: c.byZip.patient };
  };
  const period1ActiveCounts = getActiveCountsForPeriod(longAnalysisCounts?.period1Raw?.counts);
  const period2ActiveCounts = getActiveCountsForPeriod(longAnalysisCounts?.period2Raw?.counts);

  const effectiveAdjustForCancer = activeGroup === 'patient' ? adjustForCancer : false;
  const effectiveAdjustForReferrals = activeGroup === 'doctor' ? adjustForReferrals : false;

  // Get adjusted values based on user-selected options
  const displayValues = useMemo<valuesInterface>(() =>
    getDisplayValues(activeCounts, populations, cancerRates, referralCounts, perCapita, effectiveAdjustForCancer, effectiveAdjustForReferrals),
    [activeCounts, populations, cancerRates, referralCounts, perCapita, effectiveAdjustForCancer, effectiveAdjustForReferrals]
  );

  const thresholds = useMemo(() => getThresholds(displayValues, perCapita), [displayValues, perCapita]);
  const colors = COLOR_RAMPS[activeGroup as keyof typeof COLOR_RAMPS];
  const posColors = colors.positive;
  const negColors = colors.negative;
  const getColors = useMemo(() => makeGetColor(thresholds, posColors, negColors), [thresholds, posColors, negColors]);
  const legends = useMemo(() => getLegends(thresholds, posColors, negColors), [thresholds, posColors, negColors]);

  const doctorThresholds = getDoctorThresholds(doctorsByRegion);
  // Only pass selectedRegion to rankings for the referral tab — it doesn't affect region rankings
  // and would otherwise trigger an expensive recompute on every region click.
  const rankingsSelectedRegion = activeGroup === 'referral' ? selectedRegion : null;
  const rankings = useMemo(() => {
    const r = computeRankings(doctorsByRegion, activeGroup, rankingsResultsMode, zoom, displayValues, thresholds, doctorThresholds, rankingsSelectedRegion, longAnalysisCounts?.period1Raw?.doctorsByRegion, longAnalysisCounts?.period2Raw?.doctorsByRegion)
    return { topRankings: r.topRankings, worstRankings: r.worstRankings };
  },
    [activeCounts, displayValues, rankingsResultsMode, rankingsSelectedRegion, longAnalysisCounts]
  );

  const appState: AppStateTypes = {
    zoom,
    setZoom,
    activeGroup,
    setActiveGroup,
    cancerType,
    setCancerType,
    perCapita,
    setPerCapita,
    adjustForCancer,
    setAdjustForCancer,
    adjustForReferrals,
    setAdjustForReferrals,
    radiusFromThisHospital,
    setRadiusFromThisHospital,
    regionRankingsRadius,
    setRegionRankingsRadius,
    showDateRange,
    setShowDateRange,
    dateRange,
    setDateRange,
    showLongitudinalAnalysis,
    setShowLongitudinalAnalysis,
    longAnalysisPeriod1,
    setlongAnalysisPeriod1,
    longAnalysisPeriod2,
    setlongAnalysisPeriod2,
    rankingsResultsMode,
    setRankingsResultsMode,
    selectedRegion,
    setSelectedRegion,
    period1ActiveCounts,
    period2ActiveCounts,

    zipData,
    countyData,
    stateData,
    activeCounts,
    displayValues,
    doctorsByRegion,
    rankings,
    getColors,
    legends
  };

  return (
    <div>
      <main>
        <div className={`${styles.pageLayout}${sidebarOpen ? '' : ' ' + styles.sidebarCollapsed}`}>
          <div className={styles.toggleWrapper}>
            <div className={`${styles.logoWrapper}${sidebarOpen ? '' : ' ' + styles.logoWrapperCollapsed}`}>
              <span className={styles.appTitle}>Hospital Heatmap</span>
            </div>
            <div className={styles.headerContent}>
              < ActiveGroupButton model={model} appState={appState} />
              < ColorLegend key={`${activeGroup}-${perCapita}-${adjustForCancer}-${adjustForReferrals}-${dateRange}-${zoom}`} model={model} appState={appState} />
            </div>
          </div>
          <div className={`${styles.sidebar}${sidebarOpen ? '' : ' ' + styles.sidebarHidden}`}>
            < MapFilters model={model} appState={appState} />
          </div>
          <div className={styles.mapWrapper}>
            <button
              className={styles.sidebarToggle}
              onClick={() => setSidebarOpen(o => !o)}
              title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
              aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              {sidebarOpen ? '◀' : '▶'}
            </button>
            <div className={styles.mapContainer}>
              < HeatMap key="main-map" model={model} appState={appState} />
            </div>
            <div className={styles.regionRankings}>
              {/* < RegionRankingsRadiusSelector model={model} appState={appState} /> */}
              <div className={styles.rankingsOptions}>
                { activeGroup === 'referral' && < RankingsResultsModeSelector model={model} appState={appState} /> }
                {/* < LongitudinalRankingsResultsTypeSelector model={model} appState={appState} /> */}
              </div>
              < Rankings key={`${activeGroup}-${perCapita}-${adjustForCancer}-${adjustForReferrals}-${zoom}`} model={model} appState={appState} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
