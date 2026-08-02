'use client'

import React, { useEffect, useState } from 'react'
import { Patient, Doctor, Hospital, RegionsInterface, doctorsByRegionInterface } from './model';
import { populationsInterface, countsInterface, cancerRatesInterface, distancesInterface } from './model';

import populationData from '../../data_parsing/population_data/region_populations_new.json'
import zipPopData from '../../data_parsing/population_data/zip_populations.json'
import countyCancerData from '../../data_parsing/cancer_estimates/county_cancer_estimates_by_cancer_type.json'
import { cancerTypes } from './home_functions';
import { insertSorted } from './jsonParsing';

export function getDistanceBetweenPoints(coords1: [number, number], coords2: [number, number]): number {
    const lat1 = coords1[0]
    const long1 = coords1[1]
    const lat2 = coords2[0]
    const long2 = coords2[1]

    // Earth's radius in miles
    const R = 3959

    // distances in radians
    const dLatRad = (lat2 - lat1) * Math.PI / 180
    const dLongRad = (long2 - long1) * Math.PI / 180
    // latitudes in radians
    const lat1Rad = lat1 * Math.PI / 180
    const lat2Rad = lat2 * Math.PI / 180

    // Haversine Formula
    // a = sin^2(dLatRad/2) + cos(lat1Rad) * cos(lat2Rad) * sin^2(dLongRad/2)
    const sqSinLats = Math.sin(dLatRad/2) * Math.sin(dLatRad/2)
    const sqSinLongs = Math.sin(dLongRad/2) * Math.sin(dLongRad/2)
    const a = sqSinLats + (Math.cos(lat1Rad) * Math.cos(lat2Rad) * sqSinLongs)
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

    const distance = R * c

    return distance
}

// Computes the straight-line distance from target hospital to every patient, doctor, and hospital
// using the Haversine formula. Stores the result on each location object and inserts it
// into a sorted array so radius lookups can use binary search in O(log n).
function getDistancesFromThisHospital( patients: Patient[], doctors: Doctor[], hospitals: Hospital[], thisHospital: Hospital ): distancesInterface {
    const thisHospitalCoords = thisHospital.getCoords()
    const patientDists: number[] = []
    const doctorDists: number[] = []
    const hospitalDists: number[] = []
    patients.forEach((patient) => {
        const dist = getDistanceBetweenPoints(thisHospitalCoords, patient.getLocation().getCoords())
        patient.getLocation().setDistanceFromThisHospital(dist)
        insertSorted(patientDists, dist, (dist1: number, dist2: number) => dist1 - dist2)
    })
    doctors.forEach((doctor) => {
        const dist = getDistanceBetweenPoints(thisHospitalCoords, doctor.getLocation().getCoords())
        doctor.getLocation().setDistanceFromThisHospital(dist)
        insertSorted(doctorDists, dist, (dist1: number, dist2: number) => dist1 - dist2)
    })
    hospitals.forEach((hospital) => {
        const dist = getDistanceBetweenPoints(thisHospitalCoords, hospital.getCoords())
        hospital.setDistanceFromThisHospital(dist)
        insertSorted(hospitalDists, dist, (dist1: number, dist2: number) => dist1 - dist2)
    })

    return {patient: patientDists, doctor: doctorDists, hospitals: hospitalDists}
}

// Loads population figures from static JSON files.
// County keys use the format `stateAbbrev + countyName` (e.g. "FLHillsborough County")
// to match the compound key used throughout the rest of the app.
function getPopulations(): populationsInterface {
    const byCounty = new Map<string, number>();
    const entries = Object.entries(populationData.counties)
    entries.forEach((item) => {
        let state: string = item[0]
        let counties = item[1]
        for (const county in counties) {
            const region = state + county
            const pop: number = Number(counties[county as keyof typeof counties])
            byCounty.set(region, pop)
        }
    })

    const byState = new Map<string, number>(Object.entries(populationData.states));

    const byZip = new Map<string, number>(Object.entries(zipPopData.zips));

    return {byState: byState, byCounty: byCounty, byZip: byZip}
}

// Loads county-level cancer case estimates from static JSON.
// Returns two maps: total cases by cancer type and proton-eligible cases,
// each keyed by cancer type → county name.
function getCancerRates(): cancerRatesInterface {
    const cancerCountByCounty = new Map<string, Map<string, number>>();
    const cancerRates = Object.entries(countyCancerData.cancerRates)
    cancerRates.forEach((item) => {
        let cancerType = item[0]
        let counties = item[1]
        let typeData = new Map<string, number>
        for (const county in counties) {
            const numCases: number = Number(counties[county as keyof typeof counties])
            typeData.set(county, numCases)
        }
        cancerCountByCounty.set(cancerType, typeData)
    })
    const protonEligibleCountByCounty = new Map<string, Map<string, number>>();
    const protonEligible = Object.entries(countyCancerData.protonEligible)
    protonEligible.forEach((item) => {
        let cancerType = item[0]
        let counties = item[1]
        let typeData = new Map<string, number>
        for (const county in counties) {
            const numCases: number = Number(counties[county as keyof typeof counties])
            typeData.set(county, numCases)
        }
        protonEligibleCountByCounty.set(cancerType, typeData)
    })

    return {allCancerCases: cancerCountByCounty, protonEligible: protonEligibleCountByCounty}
}
//TO-DO:
// reduce number of proton eligible cases, or at least the goal percentage
// change the cancer count to be reflective of the likely numbers over the selected date range

// Builds all-time counts from the full patient and doctor arrays with no date filtering.
// This is the baseline used when no date range or longitudinal analysis is active.
// Doctor referral counts are read from the Doctor object's numReferrals field, which
// was populated during JSON parsing.
function getCounts( patients: Patient[], doctors: Doctor[] ): { counts: countsInterface, doctorsByRegion: doctorsByRegionInterface } {
    const doctorCountByState = new Map<string, number>();
    const referralCountByState = new Map<string, number>();
    const doctorsByState = new Map<string, Map<Doctor, number>>()
    for (const doctor of doctors) {
        let state = doctor.getLocation().getStateOrProvince()
        let numReferrals = doctor.getNumReferrals() ?? 0
        if (state) {
            doctorCountByState.set(state, (doctorCountByState.get(state) ?? 0) + 1);
            referralCountByState.set(state, (referralCountByState.get(state) ?? 0) + numReferrals);
            
            if (!doctorsByState.has(state)) doctorsByState.set(state, new Map<Doctor, number>);
            const stateDocs = doctorsByState.get(state)
            stateDocs?.set(doctor, numReferrals);
        }
    }
    const doctorCountByCounty = new Map<string, number>();
    const referralCountByCounty = new Map<string, number>();
    const doctorsByCounty = new Map<string, Map<Doctor, number>>();
    for (const doctor of doctors) {
        let state = doctor.getLocation().getStateOrProvince()
        let county = doctor.getLocation().getCounty()
        let numReferrals = doctor.getNumReferrals() ?? 0
        if (county) {
            let region = state + county
            doctorCountByCounty.set(region, (doctorCountByCounty.get(region) ?? 0) + 1);
            referralCountByCounty.set(region, (referralCountByCounty.get(region) ?? 0) + numReferrals);

            if (!doctorsByCounty.has(region)) doctorsByCounty.set(region, new Map<Doctor, number>);
            const countyDocs = doctorsByCounty.get(region)
            countyDocs?.set(doctor, numReferrals);
        }
    }
    const doctorCountByZip = new Map<string, number>();
    const referralCountByZip = new Map<string, number>();
    const doctorsByZip = new Map<string, Map<Doctor, number>>()
    for (const doctor of doctors) {
        let zip = doctor.getLocation().getPostalCode()
        let numReferrals = doctor.getNumReferrals() ?? 0
        if (zip) {
            doctorCountByZip.set(zip, (doctorCountByZip.get(zip) ?? 0) + 1);
            referralCountByZip.set(zip, (referralCountByZip.get(zip) ?? 0) + numReferrals);

            if (!doctorsByZip.has(zip)) doctorsByZip.set(zip, new Map<Doctor, number>);
            const zipDocs = doctorsByZip.get(zip)
            zipDocs?.set(doctor, numReferrals);
        }
    }


    const patientCountByState = new Map<string, number>();
    for (const patient of patients) {
        let state = patient.getLocation().getStateOrProvince()
        if (state) {
            patientCountByState.set(state, (patientCountByState.get(state) ?? 0) + 1);
        }
    }
    const patientCountByCounty = new Map<string, number>();
    for (const patient of patients) {
        let state = patient.getLocation().getStateOrProvince()
        let county = patient.getLocation().getCounty()
        if (county) {
            let region = state + county
            patientCountByCounty.set(region, (patientCountByCounty.get(region) ?? 0) + 1);
        }
    }
    const patientCountByZip = new Map<string, number>();
    for (const patient of patients) {
        let zip = patient.getLocation().getPostalCode()
        if (zip) {
            patientCountByZip.set(zip, (patientCountByZip.get(zip) ?? 0) + 1);
        }
    }

    return {
        counts: {
            byState: {patient: patientCountByState, doctor: doctorCountByState, referrals: referralCountByState },
            byCounty: {patient: patientCountByCounty, doctor: doctorCountByCounty, referrals: referralCountByCounty},
            byZip: {patient: patientCountByZip, doctor: doctorCountByZip, referrals: referralCountByZip}
        },
        doctorsByRegion: { byState: doctorsByState, byCounty: doctorsByCounty, byZip: doctorsByZip }
    }
}

export function parseData( patients: Patient[], doctors: Doctor[], hospitals: Hospital[], thisHospital: Hospital ) : { populations: populationsInterface, cancerRates: cancerRatesInterface, counts: countsInterface, doctorsByRegion: doctorsByRegionInterface, distances: distancesInterface } {
    const dists = getDistancesFromThisHospital(patients, doctors, hospitals, thisHospital)
    const populations = getPopulations()
    const cancerRates = getCancerRates()
    const counts = getCounts(patients, doctors)
    return {populations: populations, cancerRates: cancerRates, counts: counts.counts, doctorsByRegion: counts.doctorsByRegion, distances: dists}
}