'use client'

import React, { useEffect, useState } from 'react'
import { Doctor, doctorsByRegionInterface, Hospital, Individual, Model, RegionsInterface } from './model';
import { thresholdsInterface, valuesInterface, ZOOM_LEVEL_COUNTY, ZOOM_LEVEL_ZIP } from './home_functions';
import { activeGroupOptions, AppStateTypes, rankingsResultsModeOptions } from './page';
import { RankingsResultsModeSelector } from './boundary';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons';
import styles from './styles/page.module.css';

export const countyAbbreviations: Record<string, string> = {
    "Alachua": "ALC",
    "Baker": "BAK",
    "Bay": "BAY",
    "Bradford": "BRA",
    "Brevard": "BRE",
    "Broward": "BRO",
    "Calhoun": "CAH",
    "Charlotte": "CHA",
    "Citrus": "CIT",
    "Clay": "CLA",
    "Columbia": "CLM",
    "Collier": "CLR",
    "Miami-Dade": "DAD",
    "DeSoto": "DES",
    "Dixie": "DIX",
    "Duval": "DUV",
    "Escambia": "ESC",
    "Flagler": "FLG",
    "Franklin": "FRA",
    "Gadsden": "GAD",
    "Gilchrist": "GIL",
    "Glades": "GLA",
    "Gulf": "GUL",
    "Hamilton": "HAM",
    "Hardee": "HAR",
    "Hendry": "HEN",
    "Hernando": "HER",
    "Highlands": "HIG",
    "Hillsborough": "HIL",
    "Holmes": "HOL",
    "Indian River": "IDR",
    "Jackson": "JAC",
    "Jefferson": "JEF",
    "Lafayette": "LAF",
    "Lake": "LAK",
    "Lee": "LEE",
    "Leon": "LEO",
    "Levy": "LEV",
    "Liberty": "LIB",
    "Madison": "MAD",
    "Manatee": "MTE",
    "Marion": "MAO",
    "Martin": "MRT",
    "Monroe": "MON",
    "Nassau": "NAS",
    "Okaloosa": "OKA",
    "Okeechobee": "OKE",
    "Orange": "ORA",
    "Osceola": "OSC",
    "Palm Beach": "PAL",
    "Pasco": "PAS",
    "Pinellas": "PIN",
    "Polk": "POL",
    "Putnam": "PUT",
    "Santa Rosa": "SAN",
    "Sarasota": "SAR",
    "Seminole": "SEM",
    "St. Johns": "STJ",
    "St. Lucie": "STL",
    "Sumter": "SUM",
    "Suwannee": "SUW",
    "Taylor": "TAY",
    "Union": "UNI",
    "Volusia": "VOL",
    "Wakulla": "WAK",
    "Walton": "WAL",
    "Washington": "WAG",
};

export type rankingsInterface = {
    topRankings: {name: string, count: number, location?: string, period1Count?: number, period2Count?: number, address?: string}[],
    worstRankings: {name: string, count: number, location?: string, period1Count?: number, period2Count?: number, address?: string}[]
}

// Ranks Florida regions at the current zoom level by display value.
// Top and worst cut points are threshold-driven when available (minimum 5 entries each).
// Regions with no doctors are excluded when doctorsByRegion is provided.
function computeRankingsByRegion(zoom: number, values: valuesInterface, thresholds?: thresholdsInterface, doctorsByRegion?: doctorsByRegionInterface): rankingsInterface {
    const isZip = zoom >= ZOOM_LEVEL_ZIP
    const isCounty = (zoom >= ZOOM_LEVEL_COUNTY) && (zoom < ZOOM_LEVEL_ZIP)

    const regionValues = isZip ? values.byZip : isCounty ? values.byCounty : values.byState
    const filteredRegions = isZip ? [...regionValues.entries()].filter(obj => ((parseInt(obj[0], 10) >= 32000) && (parseInt(obj[0]) <= 35000))) : isCounty ? [...regionValues.entries()].filter(obj => (obj[0].slice(0, 2) === "FL")) : regionValues.entries()
    const regionDoctorMap = doctorsByRegion ? (isZip ? doctorsByRegion.byZip : isCounty ? doctorsByRegion.byCounty : doctorsByRegion.byState) : null;
    const sortedRegions = [...filteredRegions].filter(obj => !isNaN(obj[1])).filter(([key]) => !regionDoctorMap || (regionDoctorMap.get(key)?.size ?? 0) > 0).sort( (a, b) => {
        const valA = Number.isNaN(a[1]) ? Infinity : a[1];
        const valB = Number.isNaN(b[1]) ? Infinity : b[1];

        return valB - valA;
    } )

    const regThresholds = isZip ? thresholds?.byZip : isCounty ? thresholds?.byCounty : thresholds?.byState
    const topEnd = regThresholds ? sortedRegions.findIndex((reg) => reg[1] >= regThresholds.positive[0]) : 5
    const bottomEnd = regThresholds ? sortedRegions.findLastIndex((reg) => reg[1] <= regThresholds.positive[4]) : -5

    const topRegions = sortedRegions.slice(0, Math.max(topEnd, 5))
    const worstRegions = sortedRegions.slice(bottomEnd > sortedRegions.length - 5 ? bottomEnd : -5)

    const topRankings: {name: string, count: number, location?: string, period1Count?: number, period2Count?: number}[] = []
    const worstRankings: {name: string, count: number, location?: string, period1Count?: number, period2Count?: number}[] = []
    topRegions.forEach(region => topRankings.push({name: region[0], count: region[1]}))
    const topNames = new Set(topRankings.map(r => r.name))
    worstRegions.forEach(region => { if (!topNames.has(region[0])) worstRankings.push({name: region[0], count: region[1]}) })

    return {topRankings: topRankings, worstRankings: worstRankings.reverse()}
}

export const sortDoctorsByReferrals = (a: [Doctor, number], b: [Doctor, number]) => {
    const numReferralsA = a[1]
    const numReferralsB = b[1]
    const valA = numReferralsA;
    const valB = numReferralsB;

    return valB - valA;
}

export const sortDoctorsAlphabetically = (a: [Doctor, number], b: [Doctor, number]) => {
    const nameA = a[0].getName()
    const nameB = b[0].getName()

    return nameA.localeCompare(nameB);
}

// Filters to Florida-based doctors with at least one referral (or a non-zero change value
// in longitudinal mode, where NaN indicates a region with no data in either period).
const filterDoctors = (doctors: Map<Doctor, number>) => {
    const docArray = [...doctors]
    // console.log(docArray)
    const filtered = docArray.filter(([doc, numReferrals]) => (doc.getLocation().getStateOrProvince() === 'FL') && (Math.abs(numReferrals) > 0))

    return filtered
}

// Looks up how many referrals a specific doctor made within a single longitudinal period,
// using the doctor's own region (zip/county/state) as the lookup key.
function getDoctorPeriodCount(doctor: Doctor, periodDoctors: doctorsByRegionInterface | undefined, isZip: boolean, isCounty: boolean): number | undefined {
    if (!periodDoctors) return undefined;
    const regionMap = isZip ? periodDoctors.byZip : isCounty ? periodDoctors.byCounty : periodDoctors.byState;
    let location: string | undefined;
    if (isZip) {
        location = doctor.getLocation().getPostalCode();
    } else if (isCounty) {
        const state = doctor.getLocation().getStateOrProvince();
        const county = doctor.getLocation().getCounty();
        location = state && county ? state + county : undefined;
    } else {
        location = doctor.getLocation().getStateOrProvince();
    }
    if (!location) return undefined;
    return regionMap.get(location)?.get(doctor);
}

// Ranks individual referring doctors by referral count.
// When selectedRegion is set (user clicked a map region), narrows the list to doctors
// in that region only, turning the rankings panel into a region drill-down view.
function computeRankingsByDoctor(zoom: number, doctors: doctorsByRegionInterface, thresholds?: RegionsInterface<number[]>, selectedRegion?: string | null, period1Doctors?: doctorsByRegionInterface, period2Doctors?: doctorsByRegionInterface): rankingsInterface {
    const isZip = zoom >= ZOOM_LEVEL_ZIP
    const isCounty = (zoom >= ZOOM_LEVEL_COUNTY) && (zoom < ZOOM_LEVEL_ZIP)

    const regionDoctors = isZip ? doctors.byZip : isCounty ? doctors.byCounty : doctors.byState
    // const filteredDoctors = [...regionDoctors].filter(doc => (doc.getLocation().getStateOrProvince() === "FL"))

    const filteredDoctors = new Map<Doctor, number>();
    if (selectedRegion) {
        const docs = (regionDoctors.get(selectedRegion)) ?? new Map<Doctor, number>()
        const filtered = filterDoctors(docs)
            // console.log(filtered)
            filtered.forEach((doctor) => filteredDoctors.set(doctor[0], doctor[1]))
    } else {
        [...regionDoctors].forEach(([region, doctor]) => {
            const filtered = filterDoctors(doctor)
            // console.log(filtered)
            filtered.forEach((doctor) => filteredDoctors.set(doctor[0], doctor[1]))
        })
    }
    // console.log(regionDoctors)
    const sortedDoctors = [...filteredDoctors].sort(sortDoctorsByReferrals)

    const regThresholds = isZip ? thresholds?.byZip : isCounty ? thresholds?.byCounty : thresholds?.byState
    const topEnd = regThresholds ? sortedDoctors.findLastIndex((doctor) => doctor[1] >= regThresholds[4]) : 5
    const bottomEnd = regThresholds ? sortedDoctors.findIndex((doctor) => doctor[1] <= regThresholds[0]) : -5
    
    const topDoctors = sortedDoctors.slice(0, Math.max(topEnd, 5))
    const worstDoctors = sortedDoctors.slice(Math.max(Math.min(bottomEnd, (sortedDoctors.length - 5), -10)))
    const topRankings: {name: string, count: number, location?: string, period1Count?: number, period2Count?: number, address?: string}[] = []
    const worstRankings: {name: string, count: number, location?: string, period1Count?: number, period2Count?: number, address?: string}[] = []

    topDoctors.forEach(([doctor, numReferrals]: [Doctor, number]) => {
        const docLocation = isZip ? doctor.getLocation().getPostalCode() : isCounty ? doctor.getLocation().getCounty() : doctor.getLocation().getStateOrProvince()
        const location = (docLocation != selectedRegion?.slice(2) ? docLocation : undefined) ?? undefined
        const period1Count = getDoctorPeriodCount(doctor, period1Doctors, isZip, isCounty)
        const period2Count = getDoctorPeriodCount(doctor, period2Doctors, isZip, isCounty)
        const address = doctor.getLocation().getFullAddress() || undefined
        topRankings.push({ name: doctor.getName(), count: numReferrals, location, period1Count, period2Count, address })
    })

    const topDoctorSet = new Set(topDoctors.map(([doc]) => doc))
    worstDoctors.forEach(([doctor, numReferrals]: [Doctor, number]) => {
        if (topDoctorSet.has(doctor)) return
        const docLocation = isZip ? doctor.getLocation().getPostalCode() : isCounty ? doctor.getLocation().getCounty() : doctor.getLocation().getStateOrProvince()
        const location = (docLocation != selectedRegion?.slice(2) ? docLocation : undefined) ?? undefined
        const period1Count = getDoctorPeriodCount(doctor, period1Doctors, isZip, isCounty)
        const period2Count = getDoctorPeriodCount(doctor, period2Doctors, isZip, isCounty)
        const address = doctor.getLocation().getFullAddress() || undefined
        worstRankings.push({ name: doctor.getName(), count: numReferrals, location, period1Count, period2Count, address })
    })

    return {topRankings: topRankings, worstRankings: worstRankings.reverse()}
}

// Dispatches to region or doctor rankings depending on the active tab.
// Referrals mode ranks individual doctors; all other modes rank geographic regions.
export function computeRankings(doctorsByRegion: doctorsByRegionInterface, activeGroup: activeGroupOptions, rankingsResultsMode: rankingsResultsModeOptions, zoom: number, displayValues: valuesInterface, regionThresholds?: thresholdsInterface, doctorThresholds?: RegionsInterface<number[]>, selectedRegion?: string | null, period1Doctors?: doctorsByRegionInterface, period2Doctors?: doctorsByRegionInterface): rankingsInterface {
    if (rankingsResultsMode != "doctors") return computeRankingsByRegion(zoom, displayValues, regionThresholds, doctorsByRegion)
    else return computeRankingsByDoctor(zoom, doctorsByRegion, doctorThresholds, selectedRegion, period1Doctors, period2Doctors)
}


// Renders a hover popup that decodes the 3-letter county abbreviations currently visible
// in the top rankings list. Only shows entries for abbreviations actually on screen,
// keeping the key minimal rather than listing all 67 Florida counties.
export function CountyAbbreviationsKey({ rankings }: { rankings: rankingsInterface }) {
    // Extract abbreviations currently visible in the rankings (e.g. "Dr. Smith (HIL)")
    const visibleEntries = (() => {
        const abbrs = new Set<string>();
        //[...rankings.topRankings, ...rankings.worstRankings].forEach(({ name }) => {
        [...rankings.topRankings].forEach(({ name }) => {
            const match = name.match(/\(([A-Z]{3})\)/);
            if (match) abbrs.add(match[1]);
        });
        const reverseMap: Record<string, string> = {};
        Object.entries(countyAbbreviations).forEach(([county, abbr]) => {
            if (abbrs.has(abbr)) reverseMap[abbr] = county;
        });
        return Object.entries(reverseMap).sort((a, b) => a[0].localeCompare(b[0]));
    })();

    if (visibleEntries.length === 0) return null;

    return (
        <div className={styles.abbreviationsContainer} style={{ position: 'relative' }}>
            <button className={styles.abbreviationsKeyButton} title="County abbreviations key">
                <FontAwesomeIcon icon={fas.faCircleQuestion} />
            </button>
            <div className={styles.abbreviationsPopup}>
                <div className={`${styles.abbreviationsRow} ${styles.abbreviationsHeader}`}>
                    <span className={styles.abbreviationsCode}>Abbr</span>
                    <span>County</span>
                </div>
                {visibleEntries.map(([abbr, name]) => (
                    <div key={abbr} className={styles.abbreviationsRow}>
                        <span className={styles.abbreviationsCode}>{abbr}</span>
                        <span>{name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function Rankings({model, appState}: {model: Model, appState: AppStateTypes}) {
    const zoom = appState.zoom
    const isZip = zoom >= ZOOM_LEVEL_ZIP
    const isCounty = (zoom >= ZOOM_LEVEL_COUNTY) && (zoom < ZOOM_LEVEL_ZIP)

    const showLongitudinalAnalysis = appState.showLongitudinalAnalysis

    const rankingsResultsMode = appState.rankingsResultsMode
    const topRankings = appState.rankings.topRankings
    const worstRankings = appState.rankings.worstRankings

    const activeGroup = appState.activeGroup
    const selectedRegion = appState.selectedRegion

    const [expandedTop, setExpandedTop] = useState<Set<number>>(new Set());
    const [expandedWorst, setExpandedWorst] = useState<Set<number>>(new Set());
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const copyAddress = (address: string, key: string, e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(address);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 1500);
    };

    const toggleExpanded = (set: Set<number>, setter: React.Dispatch<React.SetStateAction<Set<number>>>, index: number) => {
        setter(prev => {
            const next = new Set(prev);
            next.has(index) ? next.delete(index) : next.add(index);
            return next;
        });
    };

    const displayRegionNames = isZip ? "Zip Codes" : isCounty ? "Counties" : "States/Regions"
    const regionName = selectedRegion ? ' - ' + selectedRegion.slice(2) : ''
    const displayNames = rankingsResultsMode != "doctors" ? displayRegionNames : "Doctors" + regionName
    const topCount = topRankings.length
    const worstCount = worstRankings.length
    const displayGroup = activeGroup === 'doctor' ? ' Doctors' : activeGroup === 'referral' ? ' Referrals' : ' Patients'
    const displayUnits = showLongitudinalAnalysis ? "%" : displayGroup

    const getPeriodCount = (periodCounts: typeof appState.period1ActiveCounts, name: string): number | null => {
        if (!periodCounts) return null;
        const map = isZip ? periodCounts.byZip : isCounty ? periodCounts.byCounty : periodCounts.byState;
        const val = map.get(name);
        return val !== undefined ? val : null;
    };

    const renderItem = (
        element: {name: string, count: number, location?: string, period1Count?: number, period2Count?: number, address?: string},
        index: number,
        expanded: Set<number>,
        setExpanded: React.Dispatch<React.SetStateAction<Set<number>>>,
        listId: 'top' | 'worst'
    ) => {
        const displayName = (rankingsResultsMode !== "doctors" && isCounty) ? element.name.slice(2, -7) : element.name;
        const displayPrefix = (showLongitudinalAnalysis && element.count > 0) ? "+" : ""
        const displayColor = showLongitudinalAnalysis ? element.count > 0 ? '#e2f3e3' : element.count < 0 ? '#faede8' : '#E8F0FA' : '#E8F0FA'
        const isExpanded = expanded.has(index);
        const canExpand = showLongitudinalAnalysis;
        const unitFor = (n: number) => {
            const abs = Math.abs(n);
            if (activeGroup === 'patient') return abs === 1 ? 'patient' : 'patients';
            if (activeGroup === 'referral') return abs === 1 ? 'referral' : 'referrals';
            return abs === 1 ? 'referrer' : 'referrers';
        };
        const p1Raw = canExpand ? (rankingsResultsMode === 'doctors' ? element.period1Count : (getPeriodCount(appState.period1ActiveCounts, element.name) ?? undefined)) : undefined;
        const p2Raw = canExpand ? (rankingsResultsMode === 'doctors' ? element.period2Count : (getPeriodCount(appState.period2ActiveCounts, element.name) ?? undefined)) : undefined;
        const eitherHasData = p1Raw !== undefined || p2Raw !== undefined;
        const p1 = eitherHasData ? (p1Raw ?? 0) : null;
        const p2 = eitherHasData ? (p2Raw ?? 0) : null;

        return (
            <li key={index} onClick={canExpand ? () => toggleExpanded(expanded, setExpanded, index) : undefined}>
                <div className={styles.rankingsRow}>
                    <div className={styles.rankingsNameGroup}>
                        <div className={styles.rankingsNameRow}>
                            <span className={styles.rankingsName}>{displayName}</span>
                            <span className={styles.rankingsCount} style={{backgroundColor: displayColor}}>{displayPrefix}{Math.round(element.count * 100) / 100}{displayUnits}</span>
                        </div>
                        {(activeGroup === 'referral' ? element.address : element.location) && (
                            <span className={styles.rankingsLocation}>
                                {activeGroup === 'referral' && element.address ? (() => {
                                    const key = `${listId}-${index}`;
                                    const copied = copiedKey === key;
                                    const street = element.address.split(',')[0];
                                    const cityStateZip = element.address.split(',').slice(1).join(',').trim();
                                    return (
                                        <>
                                            <span className={styles.rankingsAddressStreet}>{street}</span>
                                            <span className={styles.rankingsAddressCity}>
                                                {cityStateZip}
                                                <button
                                                    className={`${styles.rankingsCopyBtn}${copied ? ' ' + styles.rankingsCopyBtnDone : ''}`}
                                                    onClick={(e) => copyAddress(element.address!, key, e)}
                                                    title="Copy address"
                                                >
                                                    <FontAwesomeIcon icon={copied ? fas.faCheck : fas.faCopy} />
                                                    {copied && <span className={styles.rankingsCopiedLabel}>Copied!</span>}
                                                </button>
                                            </span>
                                        </>
                                    );
                                })() : element.location}
                            </span>
                        )}
                    </div>
                    {canExpand && (
                        <span className={`${styles.rankingsArrow}${isExpanded ? ' ' + styles.rankingsArrowExpanded : ''}`}>▾</span>
                    )}
                </div>
                {isExpanded && canExpand && (
                    <div className={styles.rankingsPeriodRow}>
                        <div className={styles.rankingsPeriodCell}>
                            <span className={styles.rankingsPeriodLabel}>Period 1</span>
                            <span className={styles.rankingsPeriodValue}>{p1 !== null ? `${p1} ${unitFor(p1)}` : '—'}</span>
                        </div>
                        <div className={styles.rankingsPeriodCell}>
                            <span className={styles.rankingsPeriodLabel}>Period 2</span>
                            <span className={styles.rankingsPeriodValue}>{p2 !== null ? `${p2} ${unitFor(p2)}` : '—'}</span>
                        </div>
                    </div>
                )}
            </li>
        );
    };

    const showWorstRankings = () => {
        if (showLongitudinalAnalysis && rankingsResultsMode != 'doctors' && worstCount > 0) {
            return (
                <div>
                    <hr className={styles.rankingsDivider} />
                    <div className={styles.rankingsHeader}>Bottom {worstCount} {displayNames}</div>
                    <ol>
                        {worstRankings.map((element, index) => renderItem(element, index, expandedWorst, setExpandedWorst, 'worst'))}
                    </ol>
                </div>
            )
        }
    }

    return (
        <div className={styles.rankingsContent}>
            <div className={styles.rankingsHeader}>Top {topCount} {displayNames}</div>
            <ol>
                {topRankings.map((element, index) => renderItem(element, index, expandedTop, setExpandedTop, 'top'))}
            </ol>
            {showWorstRankings()}
        </div>
    )
}

// Binary search on a pre-sorted distances array.
// Returns the index of the last element <= radius, so the count within radius is index + 1.
function radiusBinarySearch(distances: number[], radius: number): number {
    let low = 0
    let high = distances.length - 1
    let mid

    let result = -1

    while (high >= low) {
        mid = low + Math.floor((high - low)/2)

        if (distances[mid] == radius) {
            return mid
        }
        else if (distances[mid] < radius) {
            result = mid
            low = mid + 1
        }

        else high = mid - 1
    }

    return result
}

// Displays the count of patients or doctors within the specified mile radius of target hospital.
// Uses a pre-sorted distances array and binary search for O(log n) lookup.
export function CountWithinRadius({model, appState}: {model: Model, appState: AppStateTypes}) {
    const here = model.getThisHospital()
    const hereCoords = here.getCoords()
    const activeGroup = appState.activeGroup
    const distances = model.getDistances()
    const individuals = activeGroup === 'patient' ? distances.patient : distances.doctor // will use diff appState to include hospitals

    const radius = appState.radiusFromThisHospital
    
    let count = radiusBinarySearch(individuals, radius) + 1

    return (
        <div>
            <span># {activeGroup === 'patient' ? 'Patients' : 'Doctors'}: {count}</span>
        </div>
    )
}

// ─── Unused / not yet wired up ────────────────────────────────────────────────

// Calculate minimum radius from ThisHospital that contains a certain number of individuals
export function FindRadiusWithCount({model, appState}: {model: Model, appState: AppStateTypes}) {
    const here = model.getThisHospital()
    const activeGroup = appState.activeGroup
    const distances = model.getDistances()
    const individuals = activeGroup === 'patient' ? distances.patient : distances.doctor

    const countToFind = 500 <= individuals.length ? 500 : individuals.length //500 is a placeholder - It will be replaced with a value from appState

    const radius = individuals[countToFind - 1]
}

// To-do:
// Draw radius
// Display radius values where the total count between is a certain number (like field lines in physics)