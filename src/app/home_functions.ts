'use client'
import React, { useEffect, useState } from 'react'
import { cancerRatesInterface, countsInterface, Doctor, doctorsByRegionInterface, GroupsInterface, Model, Patient, populationsInterface, referralInterface, RegionsInterface } from './model';

export const cancerTypes: string[] = ["AllCancers", "LungAndBronchus", "Prostate", "Breast", "Colorectal", "Bladder", "HeadAndNeck", "NonHodgkin", "Melanoma", "Ovary", "Cervix",]

export type valuesInterface = RegionsInterface<Map<string, number>>
export type thresholdsInterface = RegionsInterface<{ positive: number[]; negative: number[] }>

export const ZOOM_LEVEL_ZIP = 9
export const ZOOM_LEVEL_COUNTY = 7

// Finds the first index where referral.consultDate >= target.
function lowerBound(arr: referralInterface[], target: Date): number {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (new Date(arr[mid].consultDate) < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// Recomputes counts (patients, doctors, referrals per region) scoped to a date window.
// Uses lowerBound to jump directly to the first in-range referral rather than scanning the full list.
// A patient is counted once per region even if they had multiple referrals in the window.
export function computeCounts( patients: Patient[], doctors: Doctor[], referrals: referralInterface[], startDate: Date | null, endDate: Date | null ): {counts: countsInterface, doctorsByRegion: doctorsByRegionInterface} | null {

    if (!startDate && !endDate) return null;

    //Find indexes of first and last dates within this range
    const from = startDate ? lowerBound(referrals, startDate) : 0;
    const to   = endDate ? lowerBound(referrals, new Date(endDate.getTime() + 86400000)) : referrals.length;

    // # of patients seen during this time frame
    const patientCountByState = new Map<string, number>();
    const patientCountByCounty = new Map<string, number>();
    const patientCountByZip = new Map<string, number>();
    // # of doctors who gave referrals during this time frame
    const doctorCountByState = new Map<string, number>();
    const doctorCountByCounty = new Map<string, number>();
    const doctorCountByZip = new Map<string, number>();
    // # of referrals made during this time frame
    const referralCountByState = new Map<string, number>();
    const referralCountByCounty = new Map<string, number>();
    const referralCountByZip = new Map<string, number>();
    // doctors + their referrals made during this time frame
    const doctorsByState = new Map<string, Map<Doctor, number>>();
    const doctorsByCounty = new Map<string, Map<Doctor, number>>();
    const doctorsByZip = new Map<string, Map<Doctor, number>>();

    const visitedPatients: string[] = []
    const visitedDoctors: string[] = []
    // Only loop through referrals within that range.
    for (let i = from; i < to; i++) {
        const ref = referrals[i]
        const patient = patients.find((pat) => pat.getId() === ref.patientId)
        if (patient && !(visitedPatients.includes(patient.getId()))) {
          // State
            let state = patient.getLocation().getStateOrProvince()
            if (state) {
                patientCountByState.set(state, (patientCountByState.get(state) ?? 0) + 1);
                // County
                let county = patient.getLocation().getCounty()
                if (county) {
                    let region = state + county
                    patientCountByCounty.set(region, (patientCountByCounty.get(region) ?? 0) + 1);
                }
                // Zip
                let zip = patient.getLocation().getPostalCode()
                if (zip) {
                    patientCountByZip.set(zip, (patientCountByZip.get(zip) ?? 0) + 1);
                }
            }
            visitedPatients.push(patient.getId())
        }
        const doctor = doctors.find((doc) => doc.getId() === ref.doctorId)
        if (doctor) {
            const alreadyCounted = visitedDoctors.includes(doctor.getId())
            let state = doctor.getLocation().getStateOrProvince()
            // State
            if (state) {
                if (!alreadyCounted) {
                    doctorCountByState.set(state, (doctorCountByState.get(state) ?? 0) + 1);
                    visitedDoctors.push(doctor.getId())
                }
                referralCountByState.set(state, (referralCountByState.get(state) ?? 0) + 1);
                
                if (!doctorsByState.has(state)) doctorsByState.set(state, new Map<Doctor, number>())
                const stateDocs = doctorsByState.get(state)
                stateDocs?.set(doctor, (stateDocs.get(doctor) ?? 0) + 1);

                // County
                let county = doctor.getLocation().getCounty()
                if (county) {
                  let region = state + county
                  if (!alreadyCounted) doctorCountByCounty.set(region, (doctorCountByCounty.get(region) ?? 0) + 1);
                  referralCountByCounty.set(region, (referralCountByCounty.get(region) ?? 0) + 1);

                  if (!doctorsByCounty.has(region)) doctorsByCounty.set(region, new Map<Doctor, number>())
                  const countyDocs = doctorsByCounty.get(region)
                  countyDocs?.set(doctor, (countyDocs.get(doctor) ?? 0) + 1);
                }
                
                // Zip
                let zip = doctor.getLocation().getPostalCode()
                if (zip) {
                  if (!alreadyCounted) doctorCountByZip.set(zip, (doctorCountByZip.get(zip) ?? 0) + 1);
                  referralCountByZip.set(zip, (referralCountByZip.get(zip) ?? 0) + 1);

                  if (!doctorsByZip.has(zip)) doctorsByZip.set(zip, new Map<Doctor, number>())
                  const zipDocs = doctorsByZip.get(zip)
                  zipDocs?.set(doctor, (zipDocs.get(doctor) ?? 0) + 1);
                }
            }
        }
    }

    console.log(visitedPatients.length, visitedDoctors.length)
    
    return {
      counts: {
        byState: {patient: patientCountByState, doctor: doctorCountByState, referrals: referralCountByState },
        byCounty: {patient: patientCountByCounty, doctor: doctorCountByCounty, referrals: referralCountByCounty},
        byZip: {patient: patientCountByZip, doctor: doctorCountByZip, referrals: referralCountByZip}
      },
      doctorsByRegion: { byState: doctorsByState, byCounty: doctorsByCounty, byZip: doctorsByZip }
    }
}

// Prorates annual cancer case estimates to the selected date window.
// Scales each county's annual figure by (selectedMonths / 12) so the cancer baseline
// stays proportional when a date range filter is active.
export function computeCancerRates(cancerRates: Map<string, Map<string, number>>, referrals: referralInterface[], startDate: Date | null, endDate: Date | null): Map<string, Map<string, number>> | null {
    if (!startDate && !endDate) return null;

    let minRefDate = new Date(0)
    let maxRefDate = new Date()
    if (referrals.length > 0) {
        minRefDate = referrals[0].consultDate 
        maxRefDate = referrals[referrals.length - 1].consultDate
    }
    const min = (minRefDate.getFullYear() - 1970) * 12 + minRefDate.getMonth()
    const max = (maxRefDate.getFullYear() - 1970) * 12 + maxRefDate.getMonth()

    const from = startDate ? (startDate.getFullYear() - 1970) * 12 + startDate.getMonth() : min
    const to = endDate ? (endDate.getFullYear() - 1970) * 12 + endDate.getMonth() : max
    
    const monthRange = to - from
    console.log

    const adjustedCancerRates = new Map()
    cancerRates.forEach((typeData, cancerType) => {
        let adjustedTypeData = new Map<string, number>
        typeData.forEach((numCases, county) => {
            const adjustedNum: number = (numCases / 12) * monthRange
            adjustedTypeData.set(county, adjustedNum)
        })
        adjustedCancerRates.set(cancerType, adjustedTypeData)
    })

    return adjustedCancerRates
}


// Computes per-key percent change from beforeMap to afterMap, unioning both key sets so
// keys absent in one period are treated as 0. When beforeVal is 0, the numerator is used
// as the denominator instead of dividing by zero (so a new entry reads as 100% growth).
function getMapPercentChange<T>( beforeMap: Map<T, number>, afterMap: Map<T, number> ): Map<T, number> {
  const percentChangeMap = new Map<T, number>();
  
  const keys = [...new Set([...beforeMap.keys(), ...afterMap.keys()])];

  keys.forEach((key) => {
    const beforeVal = beforeMap.get(key) ?? 0;
    const afterVal = afterMap.get(key) ?? 0;

    const numerator = (afterVal - beforeVal)
    const denominator = beforeVal == 0 ? numerator : beforeVal;
    const change = (numerator / denominator) * 100;
    
    percentChangeMap.set(key, change);
  });

  return percentChangeMap;
}

function calculateChangeBetweenCounts(startCounts: countsInterface, endCounts: countsInterface): countsInterface {
    //By State:
    const patientChangeByState = getMapPercentChange(startCounts.byState.patient, endCounts.byState.patient)
    const doctorChangeByState = getMapPercentChange(startCounts.byState.doctor, endCounts.byState.doctor)
    const referralChangeByState = getMapPercentChange(startCounts.byState.referrals, endCounts.byState.referrals)

    //By County:
    const patientChangeByCounty = getMapPercentChange(startCounts.byCounty.patient, endCounts.byCounty.patient)
    const doctorChangeByCounty = getMapPercentChange(startCounts.byCounty.doctor, endCounts.byCounty.doctor)
    const referralChangeByCounty = getMapPercentChange(startCounts.byCounty.referrals, endCounts.byCounty.referrals)

    //By Zip:
    const patientChangeByZip = getMapPercentChange(startCounts.byZip.patient, endCounts.byZip.patient)
    const doctorChangeByZip = getMapPercentChange(startCounts.byZip.doctor, endCounts.byZip.doctor)
    const referralChangeByZip = getMapPercentChange(startCounts.byZip.referrals, endCounts.byZip.referrals)

    return {
      byState: {patient: patientChangeByState, doctor: doctorChangeByState, referrals: referralChangeByState },
      byCounty: {patient: patientChangeByCounty, doctor: doctorChangeByCounty, referrals: referralChangeByCounty},
      byZip: {patient: patientChangeByZip, doctor: doctorChangeByZip, referrals: referralChangeByZip}
    }
}

// Computes per-doctor referral percent change across all regions.
// Keys are unioned from both periods so doctors who appear only in period 2
// (new referrers) are still included rather than being silently dropped.
function calculateChangeBetweenDoctorsByRegion(startCounts: doctorsByRegionInterface, endCounts: doctorsByRegionInterface): doctorsByRegionInterface {
    const computeChange = (
        startMap: Map<string, Map<Doctor, number>>,
        endMap: Map<string, Map<Doctor, number>>
    ): Map<string, Map<Doctor, number>> => {
        const result = new Map<string, Map<Doctor, number>>();
        const keys = new Set([...startMap.keys(), ...endMap.keys()]);
        keys.forEach(key => {
            const start = startMap.get(key) ?? new Map<Doctor, number>();
            const end = endMap.get(key) ?? new Map<Doctor, number>();
            result.set(key, getMapPercentChange(start, end));
        });
        return result;
    };

    return {
        byState: computeChange(startCounts.byState, endCounts.byState),
        byCounty: computeChange(startCounts.byCounty, endCounts.byCounty),
        byZip: computeChange(startCounts.byZip, endCounts.byZip),
    };
}

function calculateChangeBetweenCountsAndDoctors(startVals: {counts: countsInterface, doctorsByRegion: doctorsByRegionInterface}, endVals: {counts: countsInterface, doctorsByRegion: doctorsByRegionInterface}) : {counts: countsInterface, doctorsByRegion: doctorsByRegionInterface} {
  const countsChange = calculateChangeBetweenCounts(startVals.counts, endVals.counts)
  const doctorsByRegionChange = calculateChangeBetweenDoctorsByRegion(startVals.doctorsByRegion, endVals.doctorsByRegion)

  return { counts: countsChange, doctorsByRegion: doctorsByRegionChange }
}

// Orchestrates a longitudinal comparison between two time periods.
// Computes raw counts for each period via computeCounts, converts them to percent-change
// maps, and also returns the raw period counts so popups can display absolute values.
// If no explicit period dates are provided, defaults to an even split of the full date range.
export function computeLongitudinalAnalysis(patients: Patient[], doctors: Doctor[], referrals: referralInterface[], period1: {startDate: Date, endDate: Date} | null, period2: {startDate: Date, endDate: Date} | null): {counts: countsInterface, doctorsByRegion: doctorsByRegionInterface, period1Raw: {counts: countsInterface, doctorsByRegion: doctorsByRegionInterface}, period2Raw: {counts: countsInterface, doctorsByRegion: doctorsByRegionInterface}} | null {
    
    const numToDate = (num: number) => {
        const year = 1970 + Math.floor(num / 12)
        const month = num % 12
        return new Date(year, month)
    }

    const minDate = referrals[0].consultDate
    const maxDate = referrals[referrals.length - 1].consultDate

    const min = (minDate.getFullYear() - 1970) * 12 + minDate.getMonth()
    const max = (maxDate.getFullYear() - 1970) * 12 + maxDate.getMonth()
    const mid = min + Math.floor((max - min)/2)

    let startMonth1
    let endMonth1
    if (period1) {
        startMonth1 = (period1.startDate.getFullYear() - 1970) * 12 + period1.startDate.getMonth()
        endMonth1 = (period1.endDate.getFullYear() - 1970) * 12 + period1.endDate.getMonth()
    }

    let startMonth2
    let endMonth2
    if (period2) {
        startMonth2 = (period2.startDate.getFullYear() - 1970) * 12 + period2.startDate.getMonth()
        endMonth2 = (period2.endDate.getFullYear() - 1970) * 12 + period2.endDate.getMonth()
    }

    const from1 = startMonth1 ?? min
    const to1 = endMonth1 ?? startMonth2 ?? mid
    const from2 = startMonth2 ?? endMonth1 ?? mid
    const to2 = endMonth2 ?? max

    const counts1 = computeCounts(patients, doctors, referrals, numToDate(from1), numToDate(to1))
    const counts2 = computeCounts(patients, doctors, referrals, numToDate(from2), numToDate(to2))

    //Find % change in counts between each period
    if (counts1 && counts2) {
        const change = calculateChangeBetweenCountsAndDoctors(counts1, counts2)
        return { ...change, period1Raw: counts1, period2Raw: counts2 }
    }

    return null
}

// Applies the active display transforms to raw counts for a single region level.
// Transform order: (1) optional adjustment (cancer or referral normalization),
// then (2) optional per-capita scaling to per 100k.
function computeDisplayValues(
    activeCount: Map<string, number>,
    activePopulations: Map<string, number>,
    cancerEstimates: Map<string, number>,
    referralCount: Map<string, number>,
    perCapita: boolean,
    adjustForCancer: boolean,
    adjustForReferrals: boolean
): Map<string, number> {
    const result = new Map<string, number>();
    let countForRegion = 0
    for (const [name, count] of activeCount.entries()) {
        //Adjusted or raw data?
        if (adjustForReferrals) {
            const numReferrals = referralCount.get(name) ?? 0;
            countForRegion = numReferrals;
        } else if (adjustForCancer) {
            const cancer = cancerEstimates.get(name) ?? 0;
            countForRegion = cancer > 0 ? count/cancer : 0 //(cancer - count);
        } else {
            countForRegion = count
        }
        // Per Capita or total count?
        if (perCapita) {
            const pop = activePopulations.get(name) ?? 0;
            result.set(name, pop > 0 ? (countForRegion / pop) * 100000 : 0);
        } else {
            result.set(name, countForRegion);
        }
    }
    return result;
}

export function getDisplayValues(
  activeCounts: valuesInterface,
  activePopulations: populationsInterface,
  cancerEstimates: Map<string, number>,
  referralCounts: valuesInterface,
  perCapita: boolean,
  adjustForCancer: boolean,
  adjustForReferrals: boolean
): valuesInterface {
  const stateValues = computeDisplayValues(activeCounts.byState, activePopulations.byState, cancerEstimates, referralCounts.byState, perCapita, adjustForCancer, adjustForReferrals)
  const countyValues = computeDisplayValues(activeCounts.byCounty, activePopulations.byCounty, cancerEstimates, referralCounts.byCounty, perCapita, adjustForCancer, adjustForReferrals)
  const zipValues = computeDisplayValues(activeCounts.byZip, activePopulations.byZip, cancerEstimates, referralCounts.byZip, perCapita, adjustForCancer, adjustForReferrals)

  return {byState: stateValues, byCounty: countyValues, byZip: zipValues}
}


// Computes choropleth bucket breakpoints from a set of display values.
// Uses a log scale when data is heavily right-skewed (stdDev > mean, typical for raw counts),
// otherwise uses mean ± stdDev linear breakpoints. Enforces a minimum step of 0.1 (per-capita)
// or 1 (total count) to prevent duplicate thresholds on sparse data.
function computeThresholds(values: number[], perCapita: boolean = true, buckets: number = 5): number[] {
  if (values.length === 0) return [1, 2, 3, 4, 5];

  values.sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  let raw: number[];

  if (stdDev > mean) {
    const min = Math.max(0.1, values[0]);
    const max = values[values.length - 1];
    const logMin = Math.log(min);
    const logMax = Math.log(max);
    raw = [0];
    for (let i = 1; i < buckets; i++) {
      const logVal = logMin + (i / buckets) * (logMax - logMin);
      raw.push(Math.exp(logVal));
    }
  } else {
    raw = [
      0,
      Math.max(1, mean - stdDev / 2),
      mean,
      mean + stdDev / 2,
      mean + stdDev,
    ];
  }

  // Round based on mode, then enforce minimum spacing
  const minStep = perCapita ? 0.1 : 1;
  const thresholds: number[] = [];

  for (const val of raw) {
    const rounded = perCapita
      ? parseFloat(val.toFixed(1))
      : Math.round(val);

    if (thresholds.length === 0 || rounded > thresholds[thresholds.length - 1]) {
      thresholds.push(rounded);
    } else {
      thresholds.push(parseFloat((thresholds[thresholds.length - 1] + minStep).toFixed(1)));
    }
  }

  return thresholds;
}

export function getThresholds(displayValues: valuesInterface, perCapita: boolean = true, buckets: number = 5): thresholdsInterface {
  // By State:
  const stateValues = [...displayValues.byState.values()];
  const statePos = stateValues.filter(v => v > 0);
  const stateNeg = stateValues.filter(v => v < 0).map(v => Math.abs(v));
  const stateThresholds = {
    positive: computeThresholds(statePos, perCapita, buckets),
    negative: stateNeg.length > 0 ? computeThresholds(stateNeg, perCapita, buckets).map(t => -t) : []
  }
  // By County:
  const countyValues = [...displayValues.byCounty.values()];
  const countyPos = countyValues.filter(v => v > 0);
  const countyNeg = countyValues.filter(v => v < 0).map(v => Math.abs(v));
  const countyThresholds = {
    positive: computeThresholds(countyPos, perCapita, buckets),
    negative: countyNeg.length > 0 ? computeThresholds(countyNeg, perCapita, buckets).map(t => -t) : []
  }
  // By Zip:
  const zipValues = [...displayValues.byZip.values()];
  const zipPos = zipValues.filter(v => v > 0);
  const zipNeg = zipValues.filter(v => v < 0).map(v => Math.abs(v));
  const zipThresholds = {
    positive: computeThresholds(zipPos, perCapita, buckets),
    negative: zipNeg.length > 0 ? computeThresholds(zipNeg, perCapita, buckets).map(t => -t) : []
  }

  return {
    byState: stateThresholds,
    byCounty: countyThresholds,
    byZip: zipThresholds
  }
}

// Returns a closure that maps a display value to its choropleth fill color.
// Walks the threshold array from highest to lowest for positive values, and by
// absolute value for negative values. Returns near-white for zero/near-zero.
function computeGetColor(
  thresholds: { positive: number[]; negative: number[] },
  posColors: string[],
  negColors: string[]
) {
  const posThresholds = thresholds.positive
  const negThresholds = thresholds.negative
  return (value: number): string => {
    if (value > 0) {
      for (let i = posThresholds.length - 1; i >= 0; i--) {
        if (value >= posThresholds[i]) return posColors[i];
      }
    } else if (value < 0) {
      const abs = Math.abs(value);
      const absNeg = negThresholds.map(t => Math.abs(t));
      for (let i = 0; i <= absNeg.length - 1; i++) {
        if (abs >= absNeg[i]) return negColors[4-i];
      }
    }
    return '#f7f7f7';
  };
}

export function makeGetColor(thresholds: thresholdsInterface, posColors: string[], negColors: string[]): RegionsInterface<(value: number) => string> {
  const stateGetColor = computeGetColor(thresholds.byState, posColors, negColors)
  const countyGetColor = computeGetColor(thresholds.byCounty, posColors, negColors)
  const zipGetColor = computeGetColor(thresholds.byZip, posColors, negColors)
  return {
    byState: stateGetColor,
    byCounty: countyGetColor,
    byZip: zipGetColor
  }
}

function computeLegend(thresholds: { positive: number[], negative: number[] }, posColors: string[], negColors: string[]): {color: string, label: string}[] {
  const posThresholds = thresholds.positive
  const negThresholds = thresholds.negative

  return [
    ...negThresholds.reverse().map((t, i) => ({
      color: negColors[negColors.length - 1 - i],
      label: `<${t}`,
    })),
    ...posThresholds.map((t, i) => ({
      color: posColors[i],
      label: `>${t}`,
    })),
  ];
}

export function getLegends(thresholds: thresholdsInterface, posColors: string[], negColors: string[]): RegionsInterface<{color: string, label: string}[]> {
  const stateLegend = computeLegend(thresholds.byState, posColors, negColors)
  const countyLegend = computeLegend(thresholds.byCounty, posColors, negColors)
  const zipLegend = computeLegend(thresholds.byZip, posColors, negColors)

  return {
    byState: stateLegend,
    byCounty: countyLegend,
    byZip: zipLegend
  }
}

export const COLOR_RAMPS: GroupsInterface<{ positive: string[], negative: string[] }> = {
    referral: {
        positive: ['#c6dbef', '#6baed6', '#4292c6', '#2171b5', '#08306b'],
        negative: ['#FCE0A2', '#FAB048', '#F08A2B', '#CC5A18', '#661B00']
    },
    patient: {
        positive: ['#dadaeb', '#bcbddc', '#9e9ac8', '#756bb1', '#4a1272'],
        negative: ['#d0eeec', '#a3d5d1', '#5fb8b3', '#2d8e88', '#0d5550']
    },
    cancer:  {
        positive: ['#c7e9c0', '#74c476', '#41ab5d', '#238b45', '#00441b'],
        negative: ['#c7e9c0', '#74c476', '#41ab5d', '#238b45', '#00441b']
    },
    doctor:  {
        positive: ['#e8eaf6', '#c5cae9', '#7986cb', '#3949ab', '#283593'],
        negative: ['#fce4ec', '#f48fb1', '#ec407a', '#c2185b', '#880e4f']
    }
};


// Computes referral-count breakpoints across all individual doctors (not region totals).
// Used to determine color bands in the referrals rankings panel.
export function getDoctorThresholds(doctorsByRegion: doctorsByRegionInterface, buckets: number = 5): RegionsInterface<number[]> {
  // By State:
  const stateValues: number[] = [];
  [...doctorsByRegion.byState.values()].forEach((doctors) => doctors.forEach((value) => stateValues.push(value)));
  
  const stateThresholds = computeThresholds(stateValues)

  // By County:
  const countyValues: number[] = [];
  [...doctorsByRegion.byCounty.values()].forEach((doctors) => doctors.forEach(value => countyValues.push(value)));
  const countyThresholds = computeThresholds(countyValues)

  // By Zip:
  const zipValues: number[] = [];
  [...doctorsByRegion.byZip.values()].forEach((doctors) => doctors.forEach(value => zipValues.push(value)));
  
  const zipThresholds = computeThresholds(zipValues)

  return {
    byState: stateThresholds,
    byCounty: countyThresholds,
    byZip: zipThresholds
  }
}


// ─── Archived type stubs (superseded by the type aliases above) ───────────────

// export interface valuesInterface {
//   byState: Map<string, number>,
//   byCounty: Map<string, number>,
//   byZip: Map<string, number>
// }

// export interface thresholdsInterface {
//   byState: { positive: number[]; negative: number[] },
//   byCounty: { positive: number[]; negative: number[] },
//   byZip: { positive: number[]; negative: number[] }
// }