import { Model, Location, Patient, Doctor, Hospital, referralInterface } from './model'

import doctorsJSON from './../../sample_data/sample_doctor_addresses.json'
import patientsJSON from './../../sample_data/sample_patient_addresses.json'
import referralJSON from './../../sample_data/sample_referral_matching.json'

interface doctor {
    DoctorId: string;
    DoctorName: string;
    StateOrProvince: string;
    CityOrTownship: string;
    AddressLine1: string;
    PostalCode: string;
    FullAddress: string;
    Latitude: number;
    Longitude: number;
    GeocodeStatus: string;
    LastUpdated: string;
    County: string;
}

interface patient {
    PatientId: string;
    FirstName: string;
    LastName: string;
    StateOrProvince: string;
    CityOrTownship: string;
    AddressLine1: string;
    PostalCode: string;
    FullAddress: string;
    Latitude: number;
    Longitude: number;
    GeocodeStatus: string;
    LastUpdated: string;
    County: string;
}

interface referral {
    DoctorId: string
    PatientId: string
    ConsultDate: number
}

export type Comparator<T> = (a: T, b: T) => number;

// Inserts element into arr at the correct sorted position using binary search.
// Maintains O(log n) position lookup at the cost of O(n) splice. Used to keep
// doctors and patients sorted by ID so referral matching can use fast lookups.
export function insertSorted<T>(arr: T[], element: T, compare: Comparator<T>) {
    let low = 0;
    let high: number = arr.length;

    while (low < high) {
        let mid = Math.floor((low + high) / 2);
        if (compare(element, arr[mid]) >= 0) {
            low = mid + 1;
        } else {
            high = mid;
        }
    }
    
    // Insert the element at the precise sorted index
    arr.splice(low, 0, element);
    return arr;
}

// Parses the doctor JSON and builds three structures in one pass:
// a sorted doctor list, a hospital list grouped by address (one Hospital per unique address),
// and a list of unique geographic region values for the given scale reference field.
function parseDoctors(scaleRef: string): {doctors: Doctor[], hospitals: Hospital[], regions: string[]} {
    let json: doctor[] = doctorsJSON as doctor[]

    let d: Doctor[] = []
    let h: Hospital[] = []
    let hCount = 0
    let r: string[] = []

    json.forEach((person) => {
        let doc = new Doctor(person.DoctorId, person.DoctorName, person.StateOrProvince, person.CityOrTownship, person.AddressLine1, person.PostalCode, person.FullAddress, person.Latitude, person.Longitude, person.County, person.LastUpdated)
        insertSorted(d, doc, (doc1: Doctor, doc2: Doctor) => doc1.getId().localeCompare(doc2.getId()))

        let hos = h.find((hospital) => hospital.getFullAddress() === person.FullAddress)
        if (!hos) {
            hos = (new Hospital(person.StateOrProvince, person.CityOrTownship, person.AddressLine1, person.PostalCode, person.FullAddress, person.Latitude, person.Longitude, person.County, String(hCount)))
            h.push(hos)
            hCount++
        }
        hos.addDoctor(doc)

        let reg = r.find((region) => region === person[scaleRef as keyof doctor])
        if (!reg) {
            r.push(person[scaleRef as keyof doctor] as string)
        }
    })
    // console.log(d.length, h.length)
    return {doctors: d, hospitals: h, regions: r}
}

// Parses the patient JSON, skipping records whose geocode failed.
// Only successfully geocoded patients are included in analysis.
function parsePatients(scaleRef: string, regions: string[]): Patient[] {
    let json: patient[] = patientsJSON as patient[]

    let patients: Patient[] = []

    json.forEach((person) => {
        if (person.GeocodeStatus.includes("success")) {
            const pat = new Patient(person.PatientId, person.LastName + ", " + person.FirstName, person.StateOrProvince, person.CityOrTownship, person.AddressLine1, person.PostalCode, person.FullAddress, person.Latitude, person.Longitude, person.County, person.LastUpdated)
            insertSorted(patients, pat, (pat1: Patient, pat2: Patient) => pat1.getId().localeCompare(pat2.getId()))
        }
        let reg = regions.find((region) => region === person.CityOrTownship)
        if (!reg) {
            regions.push(person.CityOrTownship)
        }
    })
    // console.log(patients.length)
    return patients
}

// Parses referrals and wires up relationships as side effects:
// increments each Doctor's referral count and stamps the Patient's referral date.
// Must run after parseDoctors and parsePatients so IDs resolve correctly.
function parseReferrals(doctors: Doctor[], patients: Patient[]): referralInterface[] {
    let referrals: referral[] = referralJSON as referral[]
    let r: referralInterface[] = []

    referrals.forEach((referral) => {
        const referralDate = new Date(referral.ConsultDate)
        r.push({doctorId: referral.DoctorId, patientId: referral.PatientId, consultDate: referralDate})
        let doc = doctors.find((doctor) => doctor.getId() === referral.DoctorId)
        if (doc) {
            doc.addReferral()
        }
        let pat = patients.find((patient) => patient.getId() === referral.PatientId)
        if (pat) {
            pat.setReferralDate(referralDate)
        }
    })

    return r
}

// Attempts to resolve hospital facility names from the known locations list.
// Currently unused — call is commented out in parseJSONs.
// function identifyHospitals(hospitals: Hospital[]): void {
//     hospitals.forEach((hospital) => {
//         let facility = hospitalLocations.find((location) => {
//             location.AddressLine1 = hospital.getAddressLine1()
//         })
//         let name = facility?.FacilityName
//         if (name) {
//             hospital.setFacilityName(name)
//         }
//     })
// }

// Entry point for all data loading. Parses in dependency order:
// doctors first (establishes hospital list), then patients, then referrals
// (which need both doctor and patient IDs to already be resolved).
export function parseJSONs(scaleRef: string): {doctors: Doctor[], patients: Patient[], hospitals: Hospital[], referrals: referralInterface[], regions: string[]} {
    let results = parseDoctors(scaleRef)
    let d = results["doctors" as keyof typeof results] as Doctor[]
    let h = results["hospitals" as keyof typeof results] as Hospital[]
    let r = results["regions" as keyof typeof results] as string[]

    let p = parsePatients(scaleRef, r)

    let ref = parseReferrals(d, p)
    // identifyHospitals(h)

    return {doctors: d, patients: p, hospitals: h, referrals: ref, regions: r}
}