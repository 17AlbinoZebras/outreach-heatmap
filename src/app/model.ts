import { parseJSONs } from './jsonParsing'
import { parseData } from './dataParsing'

export interface RegionsInterface<T> {
  byState: T;
  byCounty: T;
  byZip: T;
}
export interface GroupsInterface<T> {
  doctor: T;
  patient: T;
  cancer: T;
  referral: T;
}

export interface referralInterface {
    doctorId: string
    patientId: string
    consultDate: Date
}
export interface cancerRatesInterface {
    allCancerCases: Map<string, Map<string, number>>
    protonEligible: Map<string, Map<string, number>>
}

export type populationsInterface = RegionsInterface<Map<string, number>>

export type countsInterface = RegionsInterface<{ patient: Map<string, number>, doctor: Map<string, number>, referrals: Map<string, number> }>

export type doctorsByRegionInterface = RegionsInterface<Map<string, Map<Doctor, number>>>

export interface distancesInterface {
    patient: number[],
    doctor: number[],
    hospitals: number[]
}

export class Model {
    doctors: Doctor[]
    patients: Patient[]
    hospitals: Hospital[]
    referrals: referralInterface[]
    thisHospital: Hospital
    // scaleReference: string
    // regions: string[]
    populations: populationsInterface
    counts: countsInterface
    doctorsByRegion: doctorsByRegionInterface
    cancerRates: cancerRatesInterface
    distances: distancesInterface

    constructor(scaleReference: string) {
        // this.scaleReference = scaleReference
        let jsonResults: {doctors: Doctor[], patients: Patient[], hospitals: Hospital[], referrals: referralInterface[], regions: string[]} = parseJSONs(scaleReference)
        this.doctors = jsonResults["doctors" as keyof typeof jsonResults] as Doctor[]
        this.patients = jsonResults["patients" as keyof typeof jsonResults] as Patient[]
        this.hospitals = jsonResults["hospitals" as keyof typeof jsonResults] as Hospital[]
        
        const referrals = jsonResults["referrals" as keyof typeof jsonResults] as referralInterface[]
        const sortedReferrals = [...referrals].sort((a, b) =>
            new Date(a.consultDate).getTime() - new Date(b.consultDate).getTime()
        );
        this.referrals = sortedReferrals
        
        let thisHospital = this.hospitals.find((hospital) => hospital.getFacilityName() === "Fake Hospital")
        //if the target hospital does not yet exist, create it and add it to the list of hospitals
        if (!thisHospital) {
            thisHospital = new Hospital("FL", "Palm Beach", "123 Abc Rd", "33480", "123 Abc Rd, Palm Beach, FL 33480", 26.700488237926315, -80.03558267301347, "Palm Beach County", this.hospitals.length.toString())
            this.hospitals.push(thisHospital)
            this.thisHospital = thisHospital
        }
        this.thisHospital = thisHospital

        // this.regions = jsonResults["regions" as keyof typeof jsonResults] as string[]

        let dataResults: {populations: populationsInterface, counts: countsInterface, cancerRates: cancerRatesInterface, distances: distancesInterface, doctorsByRegion: doctorsByRegionInterface} = parseData(this.patients, this.doctors, this.hospitals, this.thisHospital)
        this.populations = dataResults.populations
        this.cancerRates = dataResults.cancerRates
        this.counts = dataResults.counts
        this.doctorsByRegion = dataResults.doctorsByRegion
        this.distances = dataResults.distances
    }

    getDoctors(): Doctor[] {
        return this.doctors
    }

    getDoctor(id: string): Doctor | undefined {
        return this.doctors.find((doctor) => doctor.id === id)
    }

    getPatients(): Patient[] {
        return this.patients
    }

    getPatient(id: string): Patient | undefined {
        return this.patients.find((patient) => patient.id === id)
    }

    getHospitals(): Hospital[] {
        return this.hospitals
    }

    getReferrals(): referralInterface[] {
        return this.referrals
    }

    getThisHospital(): Hospital {
        return this.thisHospital
    }
    
    // getScaleReference(): string {
    //     return this.scaleReference
    // }

    // getRegions(): string[] {
    //     return this.regions
    // }

    getPopulations(): populationsInterface {
        return this.populations
    }

    getCancerRates(): cancerRatesInterface {
        return this.cancerRates
    }

    getCounts(): countsInterface {
        return this.counts
    }

    getDoctorsByRegion(): doctorsByRegionInterface {
        return this.doctorsByRegion
    }

    getDistances(): distancesInterface {
        return this.distances
    }

    addDoctor(doctor: Doctor) {
        this.doctors.push(doctor)
    }

    addPatient(patient: Patient) {
        this.patients.push(patient)
    }

    addHospital(hospital: Hospital) {
        this.hospitals.push(hospital)
    }

    // setScaleReference(scaleRef: string) {
    //     this.scaleReference = scaleRef
    // }

    // addRegion(reg: string) {
    //     this.regions.push(reg)
    // }

    setCounts(newCounts: countsInterface) {
        this.counts = newCounts
    }
}

export class Location {
    stateOrProvince: string
    cityOrTownship: string
    addressLine1: string
    postalCode: string
    fullAddress: string
    latitude: number
    longitude: number
    county: string | null
    distanceFromThisHospital: number

    constructor(stateOrProvince: string, cityOrTownship: string, addressLine1: string, postalCode: string, fullAddress: string, latitude: number, longitude: number, county: string | null) {
        this.stateOrProvince = stateOrProvince
        this.cityOrTownship = cityOrTownship
        this.addressLine1 = addressLine1
        this.postalCode = postalCode ? postalCode.slice(0, 5) : postalCode // truncate ZIP+4 to 5-digit base ZIP
        this.fullAddress = fullAddress
        this.latitude = latitude
        this.longitude = longitude
        this.county = county
        this.distanceFromThisHospital = 0
    }

    getStateOrProvince(): string {
        return this.stateOrProvince
    }

    getCityOrTownship(): string {
        return this.cityOrTownship
    }

    getAddressLine1(): string {
        return this.addressLine1
    }

    getPostalCode(): string {
        return this.postalCode
    }

    getFullAddress(): string {
        return this.fullAddress
    }

    getLatitude(): number {
        return this.latitude
    }

    getLongitude(): number {
        return this.longitude
    }

    getCoords(): [number, number] {
        return [this.latitude, this.longitude]
    }

    getCounty(): string | null {
        return this.county
    }

    getDistanceFromThisHospital() {
        return this.distanceFromThisHospital
    }

    setDistanceFromThisHospital(dist: number) {
        this.distanceFromThisHospital = dist
    }
}

export class Hospital extends Location {
    id: string
    facilityName: string
    doctors: Doctor[]
    numReferrals: number

    constructor(stateOrProvince: string, cityOrTownship: string, addressLine1: string, postalCode: string, fullAddress: string, latitude: number, longitude: number, county: string | null, id: string) {
        super(stateOrProvince, cityOrTownship, addressLine1, postalCode, fullAddress, latitude, longitude, county)
        this.id = id
        this.facilityName = addressLine1
        this.doctors = []
        this.numReferrals = 0
    }

    getId(): string {
        return this.id
    }

    getFacilityName(): string {
        return this.facilityName
    }

    getDoctors(): Doctor[] {
        return this.doctors
    }

    getNumReferrals(): number {
        return this.numReferrals
    }
    
    setFacilityName(name: string) {
        this.facilityName = name
    }

    addDoctor(doctor: Doctor) {
        this.doctors.push(doctor)
    }
}

export class Individual {
    id: string
    name: string
    location: Location
    lastUpdated: Date

    constructor(id: string, name: string, stateOrProvince: string, cityOrTownship: string, addressLine1: string, postalCode: string, fullAddress: string, latitude: number, longitude: number, county: string | null, lastUpdated: string) {
        this.id = id
        this.name = name
        this.location = new Location (stateOrProvince, cityOrTownship, addressLine1, postalCode, fullAddress, latitude, longitude, county)
        this.lastUpdated = new Date(lastUpdated)
    }

    getId(): string {
        return this.id
    }

    getName(): string {
        return this.name
    }

    getLocation(): Location {
        return this.location
    }

    getDateLastUpdated(): Date {
        return this.lastUpdated
    }
}

export class Doctor extends Individual {
    numReferrals: number | undefined

    constructor(id: string, name: string, stateOrProvince: string, cityOrTownship: string, addressLine1: string, postalCode: string, fullAddress: string, latitude: number, longitude: number, county: string | null, lastUpdated: string) {
        super(id, name, stateOrProvince, cityOrTownship, addressLine1, postalCode, fullAddress, latitude, longitude, county, lastUpdated)
    }

    getNumReferrals(): number | undefined {
        return this.numReferrals
    }

    addReferral() {
        if (!this.numReferrals) this.numReferrals = 0
        this.numReferrals++
    }
}

export class Patient extends Individual {
    dateReferred: Date

    constructor(id: string, name: string, stateOrProvince: string, cityOrTownship: string, addressLine1: string, postalCode: string, fullAddress: string, latitude: number, longitude: number, county: string | null, lastUpdated: string) {
        super(id, name, stateOrProvince, cityOrTownship, addressLine1, postalCode, fullAddress, latitude, longitude, county, lastUpdated)
        this.dateReferred = new Date(0)
    }

    getDateReferred(): Date {
        return this.dateReferred
    }

    setReferralDate(referralDate: Date) {
        this.dateReferred = referralDate
    }
}


// ─── Archived type stubs (superseded by the type aliases above) ───────────────

// export interface countsInterface {
//     byState: { patient: Map<string, number>, doctor: Map<string, number>, referrals: Map<string, number> }
//     byCounty: { patient: Map<string, number>, doctor: Map<string, number>, referrals: Map<string, number> }
//     byZip: { patient: Map<string, number>, doctor: Map<string, number>, referrals: Map<string, number> }
// }