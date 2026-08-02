'use client'

import React, { useEffect, useState } from 'react'
import { Slider, Popover } from "radix-ui";
import { Tooltip } from 'react-tooltip'
import 'react-tooltip/dist/react-tooltip.css'

import { Model, RegionsInterface } from './model';
import { cancerTypes, ZOOM_LEVEL_COUNTY, ZOOM_LEVEL_ZIP } from './home_functions';
import { CountWithinRadius } from './hospitalMetrics';

import styles from './styles/boundary.module.css'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { fas } from '@fortawesome/free-solid-svg-icons'
import { activeGroupOptions, AppStateTypes, rankingsResultsModeOptions } from './page';
// import { far } from '@fortawesome/free-regular-svg-icons'
// import { fab } from '@fortawesome/free-brands-svg-icons'

export function ActiveGroupButton( {model, appState}: {model: Model, appState: AppStateTypes} ) {
    const activeGroup = appState.activeGroup
    const setActiveGroup = appState.setActiveGroup

    const setCancerType = appState.setCancerType
    const setShowLongitudinalAnalysis = appState.setShowLongitudinalAnalysis

    const setRankingsResultsMode = appState.setRankingsResultsMode

    const setZoom = appState.setZoom

    const changeActiveGroup = (newGroup: activeGroupOptions) => {
        // if (newGroup === 'cancer') {
        //     setShowLongitudinalAnalysis(false)
        // }
        if (newGroup != 'cancer') {
            setCancerType('AllCancers')
        }

        setRankingsResultsMode("regions")

        // setZoom(7)
        setActiveGroup(newGroup)
    }

    return (
        <div className={styles.toggleContainer}>
            <button
            className={`${styles.toggleButton} ${activeGroup === 'patient' ? styles.toggleButtonActivePatient : ''}`}
            onClick={() => changeActiveGroup('patient')}
            data-tooltip-id="sidebar-tooltip"
            data-tooltip-place="bottom"
            data-tooltip-content="Number of unique referred patients per region.">Patients</button>

            <button
            className={`${styles.toggleButton} ${activeGroup === 'doctor' ? styles.toggleButtonActiveDoctor : ''}`}
            onClick={() => changeActiveGroup('doctor')}
            data-tooltip-id="sidebar-tooltip"
            data-tooltip-place="bottom"
            data-tooltip-content="Number of unique referring doctors per region.">Doctors</button>

            <button
            className={`${styles.toggleButton} ${activeGroup === 'referral' ? styles.toggleButtonActiveReferral : ''}`}
            onClick={() => changeActiveGroup('referral')}
            data-tooltip-id="sidebar-tooltip"
            data-tooltip-place="bottom"
            data-tooltip-content="Total number of referrals to target hospital per region.">Referrals</button>
            
            {/* <button
            className={`${styles.toggleButton} ${activeGroup === 'cancer' ? styles.toggleButtonActiveCancer : ''}`}
            onClick={() => changeActiveGroup('cancer')}>Cancer Estimates</button> */}
        </div>
    )
}

export function ColorLegend( {model, appState}: {model: Model, appState: AppStateTypes} ) {
    const activeGroup = appState.activeGroup
    const perCapita = appState.perCapita
    const zoom = appState.zoom
    const legends: RegionsInterface<{color: string, label: string}[]> = appState.legends
    const legend: { color: string, label: string }[] = zoom >= ZOOM_LEVEL_ZIP ? legends.byZip: zoom >= ZOOM_LEVEL_COUNTY ? legends.byCounty: legends.byState

    const title = (activeGroup === 'doctor' ? 'Doctors' : activeGroup === 'referral' ? 'Referrals' : 'Patients')
    const resultsType = perCapita ? " - per 100k" : " - Total"

    return (
        <div style={{display: 'flex'}}>
            <div className={styles.legend}>
                <div className={styles.legendTitle}>{title + resultsType}</div>
                <div className={styles.legendBar}>
                    {legend.map((c) => (
                        <div key={c.label} className={styles.legendSegment}>
                            <span className={styles.legendSwatch} style={{ background: c.color }} />
                            <span className={styles.legendLabel}>{c.label}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className={`${styles.legendSegment}, ${styles.legendOutline}`}>
                <span className={styles.legendSwatch} style={{ background: '#FAFAF888', borderRadius: '3px', boxShadow: ' inset 0 0 0 2px #2ea043' }} />
                <span className={styles.legendLabel} style={{color: '#385576'}}>Top Region</span>
            </div>
        </div>
    );
}

// FILTERS:
function CancerTypeSelector({model, appState}: {model: Model, appState: AppStateTypes}) {
    const cancerType = appState.cancerType
    const setCancerType = appState.setCancerType

    const cancerTypesPretty: string[] = ["All Cancers", "Lung & Bronchus", "Prostate", "Breast", "Colorectal", "Bladder", "Head & Neck", "Non-Hodgkin", "Melanoma", "Ovary", "Cervix",]

    const changeCancerType = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target) {
            setCancerType(event.target.value)
        }
    }

    return (
        <div className='selectCancerTypes'>
            <p>Data For:</p>
            {cancerTypes.map((type: string, index: number) => (
                <div key={index}>
                    <label><input type="radio" id={type} name="cancerTypes" value={type} checked={cancerType === type} onChange={changeCancerType}/> {cancerTypesPretty[index]}</label><br/>
                </div>
            ))}
        </div>
    )
}

function ShowDateRangeSelector({model, appState}: {model: Model, appState: AppStateTypes}) {
    const showDateRange = appState.showDateRange
    const setShowDateRange = appState.setShowDateRange

    const changeShowDateRange = () => {
        const newVal = !showDateRange
    }
    
    return (
        <div className={styles.filterSection}>
            <div className={styles.toggleRow}>
                <span className={styles.toggleRowLabel}>
                    Filter by Date Range
                    <span className={styles.infoIcon} data-tooltip-id="sidebar-tooltip" data-tooltip-content="Limits the map to referrals with a consult date within the selected window. Counts outside the window are excluded.">
                        <FontAwesomeIcon icon={fas.faCircleInfo} />
                    </span>
                </span>
                <label className={styles.toggleSwitch}>
                    <input type="checkbox" id='showDateRange' name="showDateRange" checked={showDateRange} onChange={() => {
                        if (!showDateRange) appState.setShowLongitudinalAnalysis(false);
                        setShowDateRange(!showDateRange);
                    }}/>
                    <span className={styles.toggleSlider}></span>
                </label>
            </div>
            {showDateRange && <div className={styles.filterExpanded}><DateRangeSelector model={model} appState={appState} /></div>}
        </div>
    )
}

// Renders a two-thumb date range slider. When locked, dragging either thumb shifts the
// entire window without changing its width, clamping at the data bounds.
function DateRangeSelector({model, appState}: {model: Model, appState: AppStateTypes}) {
    const dateRange = appState.dateRange
    const setDateRange = appState.setDateRange

    const referrals = model.getReferrals()

    const [lockDateRange, setLockDateRange] = useState(false);

    const numToDate = (num: number) => {
        const year = 1970 + Math.floor(num / 12)
        const month = num % 12
        return new Date(year, month)
    }

    const dateToNum = (date: Date) => {
        return (date.getFullYear() - 1970) * 12 + date.getMonth()
    }

    let minRefDate = new Date(0)
    let maxRefDate = new Date()
    if (referrals.length > 0) {
        minRefDate = referrals[0].consultDate 
        maxRefDate = referrals[referrals.length - 1].consultDate
    }
    const min = dateToNum(minRefDate)
    const max = dateToNum(maxRefDate)

    const changeDateRange = (values: number[]) => {
        if (values[0] == min && values[1] == max) {
            setDateRange({start: null, end: null})
        }
        else {
            const startDate = numToDate(values[0])
            const endDate = numToDate(values[1])
            setDateRange({start: startDate, end: endDate})
        }
    }

    const [vals, setVals] = useState([dateRange.start ? dateToNum(dateRange.start) : (max - 12), dateRange.end ? dateToNum(dateRange.end) : max]);
    let diff = vals[1] - vals[0]
    const changeSliderVals = (values: [number, number]) => {
        let left = values[0]
        let right = values[1]

        // try setting diff when the lock is done, to ensure it doesn't change
        if (lockDateRange) {
            const prevLeft = vals[0]
            const prevRight = vals[1]
            if (left != prevLeft) {
                right = left + diff
            }
            else if (right != prevRight) {
                left = right - diff
            }

            if (left < min) {
                left = min
                right = left + diff
            }
            else if (right > max) {
                right = max
                left = right - diff
            }
        }
        
        setVals([left, right])
        
    }

    const numToDateLabel = (num: number) => {
        const date = numToDate(num)
        const monthName = date.toLocaleString('default', { month: 'long' })
        const year = date.getFullYear()

        return(monthName + " " + year)
    }
    
    const dateRangeLabel = (monthFrom: number, monthTo: number) => {
        const range = monthTo - monthFrom
        const years = Math.floor(range / 12)
        const months = range % 12

        const yearLabel = ((years > 0) ? years +  " Yr" + ((years > 1) ? "s" : "") : null)
        const monthLabel = ((months > 0) ? months + " Mo" + ((months > 1) ? "s" : "") : null)
        let rangeLabel = (yearLabel ? yearLabel + (monthLabel ? ", " : " ") : "")
        rangeLabel += monthLabel ? monthLabel : ""

        return (rangeLabel)
    }

    const changeLockDateRange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setLockDateRange(!lockDateRange)
        diff = vals[1] - vals[0]
    }

    return (
        <div className={styles.dateRangeSlider}>
            <form>
                <Slider.Root className={styles.SliderRoot} min={min} max={max} value={vals} onValueChange={changeSliderVals} onValueCommit={changeDateRange} minStepsBetweenThumbs={1}>
                    <Slider.Track className={styles.SliderTrack}>
                        <Slider.Range className={styles.SliderRange} />
                    </Slider.Track >
                    <Slider.Thumb className={styles.SliderThumb} style={{backgroundColor: '#fb6a4a'}}/>
                    <Slider.Thumb className={styles.SliderThumb} style={{backgroundColor: '#4aa2dd'}}/>
                </Slider.Root>
            </form>
            <div className={styles.sliderLabelRow}>
                <span className={styles.sliderDateChip} style={{background: '#fff0ee', color: '#b94040'}}>{numToDateLabel(vals[0])}</span>
                <span className={styles.sliderLabelSep}>–</span>
                <span className={styles.sliderDateChip} style={{background: '#eff6ff', color: '#2166a8'}}>{numToDateLabel(vals[1])}</span>
                <span className={styles.sliderDuration}>{dateRangeLabel(vals[0], vals[1])}</span>
                <label className={`${styles.lockLabel} ${lockDateRange ? styles.lockLabelActive : ''}`} data-tooltip-id="sidebar-tooltip" data-tooltip-content="Locks the window width. Dragging either handle shifts the entire range without changing its duration.">
                    <input type="checkbox" id='lockDateRange' name="lockDateRange" value='true' onChange={changeLockDateRange}/>
                    <FontAwesomeIcon icon={lockDateRange ? fas.faLock : fas.faLockOpen} widthAuto/>
                </label>
            </div>
        </div>
    )
}


function ShowLongitudinalAnalysisSelector({model, appState}: {model: Model, appState: AppStateTypes}) {
    const longitudinalAnalysis = appState.showLongitudinalAnalysis
    const setLongitudinalAnalysis = appState.setShowLongitudinalAnalysis

    const changeLongitudinalAnalysis = () => {
        const newVal = !longitudinalAnalysis
    }
    
    return (
        <div className={styles.filterSection}>
            <div className={styles.toggleRow}>
                <span className={styles.toggleRowLabel}>
                    Longitudinal Analysis
                    <span className={styles.infoIcon} data-tooltip-id="sidebar-tooltip" data-tooltip-content="Compares activity between two time periods. The map shows the percent change from Period 1 to Period 2. Positive values mean more activity in the recent period.">
                        <FontAwesomeIcon icon={fas.faCircleInfo} />
                    </span>
                </span>
                <label className={styles.toggleSwitch}>
                    <input type="checkbox" id='showLongitudinalAnalysis' name="showLongitudinalAnalysis" checked={longitudinalAnalysis} onChange={() => {
                        if (!longitudinalAnalysis) appState.setShowDateRange(false);
                        setLongitudinalAnalysis(!longitudinalAnalysis);
                    }}/>
                    <span className={styles.toggleSlider}></span>
                </label>
            </div>
            {longitudinalAnalysis && <div className={styles.filterExpanded}><LongitudinalAnalysisRangeSelector model={model} appState={appState} /></div>}
        </div>
    )
}

// Renders two linked period sliders on the same axis. Periods cannot overlap: when the
// right edge of period 1 approaches the left edge of period 2 within SNAP_DISTANCE months,
// period 2's left thumb snaps to follow rather than allowing overlap. Each slider also
// supports independent width-locking (same logic as DateRangeSelector).
function LongitudinalAnalysisRangeSelector({model, appState}: {model: Model, appState: AppStateTypes}) {
    const period1 = appState.longAnalysisPeriod1
    const setPeriod1 = appState.setlongAnalysisPeriod1

    const period2 = appState.longAnalysisPeriod2
    const setPeriod2 = appState.setlongAnalysisPeriod2

    const referrals = model.getReferrals()

    const numToDate = (num: number) => {
        const year = 1970 + Math.floor(num / 12)
        const month = num % 12
        return new Date(year, month)
    }

    const dateToNum = (date: Date) => {
        return (date.getFullYear() - 1970) * 12 + date.getMonth()
    }

    const [lockDateRange1, setLockDateRange1] = useState(true);
    const [lockDateRange2, setLockDateRange2] = useState(true);

    let minRefDate = new Date(0)
    let maxRefDate = new Date()
    if (referrals.length > 0) {
        minRefDate = referrals[0].consultDate 
        maxRefDate = referrals[referrals.length - 1].consultDate
    }
    const min = dateToNum(minRefDate)
    const max = dateToNum(maxRefDate)
    const mid = min + Math.floor((max - min) / 2)
    

    const changeDateRange = (values: number[], dateRange: { startDate: Date; endDate: Date } | null, setDateRange: any) => {
        const startDate = numToDate(values[0])
        const endDate = numToDate(values[1])
        setDateRange({startDate: startDate, endDate: endDate})
    }
    const changePeriod1 = (values: number[]) => {
        changeDateRange(values, period1, setPeriod1)
    }
    const changePeriod2 = (values: number[]) => {
        changeDateRange(values, period2, setPeriod2)
    }


    const SNAP_DISTANCE = 3
    // Previous year
    const [vals1, setVals1] = useState([period1 ? dateToNum(period1.startDate) : (max - 24), period1 ? dateToNum(period1.endDate) : (max - 12)]);
    let diff1 = vals1[1] - vals1[0]
    const changeVals1 = (values: [number, number]) => {
        let left = values[0]
        let right = values[1]

        // if the left slider passes the right slider
        const effectiveSnap = Math.min(SNAP_DISTANCE, max - right + 1);
        if (right > vals2[0]) {
            if (right > (vals2[0] + effectiveSnap)) {
                changeVals2([right, vals2[1]])
            }
            right = vals2[0]
        }

        const effectiveMax = vals2[0]
        if (left <= min) {
            if (right <= min) {
                right = min + 1
            }
            left = min
        }
        else if (right >= effectiveMax) {
            if (left >= effectiveMax) {
                left = effectiveMax - 1
            }
            right = effectiveMax
        }

        if (lockDateRange1) {
            const prevLeft = vals1[0]
            const prevRight = vals1[1]
            if (left != prevLeft) {
                right = left + diff1
            }
            else if (right != prevRight) {
                left = right - diff1
            }
            if (left <= min) {
                left = min
                right = left + diff1
            }
            else if (right >= effectiveMax) {
                right = effectiveMax
                left = right - diff1
            }
        }

        if ((right - left) < 1) {
            const prevLeft = vals1[0]
            const prevRight = vals1[1]
            if (left != prevLeft) {
                right = left + 1
            }
            else if (right != prevRight) {
                left = right - 1
            }
        }
        
        setVals1([left, right]) 
    }
    // Most recent year
    const [vals2, setVals2] = useState([period2 ? dateToNum(period2.startDate) : (max - 12), period2 ? dateToNum(period2.endDate) : max]);
    let diff2 = vals2[1] - vals2[0]
    const changeVals2 = (values: [number, number]) => {
        let left = values[0]
        let right = values[1]

        // if the right slider passes the left slider
        const effectiveSnap = Math.min(SNAP_DISTANCE, left - min);
        if (left < vals1[1]) {
            if (left < (vals1[1] - effectiveSnap)) {
                changeVals1([vals1[0], left])
            }
            left = vals1[1]
        }

        const effectiveMin = vals1[1]
        if (left <= effectiveMin) {
            if (right <= effectiveMin) {
                right = effectiveMin + 1
            }
            left = effectiveMin
        }
        else if (right >= max) {
            if (left >= max) {
                left = max - 1
            }
            right = max
        }

        if (lockDateRange2) {
            const prevLeft = vals2[0]
            const prevRight = vals2[1]
            if (left != prevLeft) {
                right = left + diff2
            }
            else if (right != prevRight) {
                left = right - diff2
            }
            if (left <= effectiveMin) {
                left = effectiveMin
                right = left + diff2
            }
            else if (right >= max) {
                right = max
                left = right - diff2
            }
        }

        if ((right - left) < 1) {
            const prevLeft = vals2[0]
            const prevRight = vals2[1]
            if (left != prevLeft) {
                right = left + 1
            }
            else if (right != prevRight) {
                left = right - 1
            }
        }
        
        setVals2([left, right]) 
    }

    const numToDateLabel = (num: number) => {
        const date = numToDate(num)
        const monthName = date.toLocaleString('default', { month: 'long' })
        const year = date.getFullYear()

        return(monthName + " " + year)
    }
    
    const dateRangeLabel = (monthFrom: number, monthTo: number) => {
        const range = monthTo - monthFrom
        const years = Math.floor(range / 12)
        const months = range % 12

        const yearLabel = ((years > 0) ? years +  " Yr" + ((years > 1) ? "s" : "") : null)
        const monthLabel = ((months > 0) ? months + " Mo" + ((months > 1) ? "s" : "") : null)
        let rangeLabel = (yearLabel ? yearLabel + (monthLabel ? ", " : " ") : "")
        rangeLabel += monthLabel ? monthLabel : ""

        return (rangeLabel)
    }

    const changeLockDateRange1 = (event: React.ChangeEvent<HTMLInputElement>) => {
        setLockDateRange1(!lockDateRange1)
        diff1 = vals1[1] - vals1[0]
    }
    const changeLockDateRange2 = (event: React.ChangeEvent<HTMLInputElement>) => {
        setLockDateRange2(!lockDateRange2)
        if (lockDateRange2) {}
        diff2 = vals2[1] - vals2[0]
    }

    return (
        <div className={styles.longitudinalAnalysisSelector}>
            <div className={styles.longAnalysisSlider}>
                <span className={styles.subtitle}>Period 1</span>
                <form style={{paddingTop: '6px'}}>
                    <Slider.Root className={styles.SliderRoot} min={min} max={max} value={vals1} onValueChange={changeVals1} onValueCommit={changePeriod1} minStepsBetweenThumbs={1} style={{width: '100%'}}>
                        <Slider.Track className={styles.SliderTrack} style={{pointerEvents: 'none'}}>
                            <Slider.Range className={styles.SliderRange} style={{backgroundColor: '#F5C571', boxShadow: 'inset 0 0 2px rgba(0, 0, 0, 40%)'}} />
                        </Slider.Track >
                        <Slider.Thumb className={styles.longitudinalSliderThumb} style={{backgroundColor: '#F5DD71'}}/>
                        <Slider.Thumb className={styles.longitudinalSliderThumb} style={{backgroundColor: '#F5AC71'}}/>
                    </Slider.Root>
                </form>
                <div className={styles.sliderLabelRow}>
                    <span className={styles.sliderDateChip} style={{background: '#fef6e0', color: '#7a5c00'}}>{numToDateLabel(vals1[0])}</span>
                    <span className={styles.sliderLabelSep}>–</span>
                    <span className={styles.sliderDateChip} style={{background: '#fde8d0', color: '#7a3800'}}>{numToDateLabel(vals1[1])}</span>
                    <span className={styles.sliderDuration}>{dateRangeLabel(vals1[0], vals1[1])}</span>
                    <label className={`${styles.lockLabel} ${lockDateRange1 ? styles.lockLabelActive : ''}`} data-tooltip-id="sidebar-tooltip" data-tooltip-content="Locks the window width. Dragging either handle shifts the entire range without changing its duration.">
                        <input type="checkbox" onChange={changeLockDateRange1} defaultChecked/>
                        <FontAwesomeIcon icon={lockDateRange1 ? fas.faLock : fas.faLockOpen} widthAuto/>
                    </label>
                </div>
            </div>
            <div className={styles.longAnalysisSlider}>
                <span className={styles.subtitle} style={{color: '#5e2e4e'}}>Period 2</span>
                <form style={{paddingTop: '6px'}}>
                    <Slider.Root className={styles.SliderRoot} min={min} max={max} value={vals2} onValueChange={changeVals2} onValueCommit={changePeriod2} minStepsBetweenThumbs={1} style={{width: '100%'}}>
                        <Slider.Track className={styles.SliderTrack} style={{pointerEvents: 'none'}}>
                            <Slider.Range className={styles.SliderRange} style={{backgroundColor: '#C78DB4', boxShadow: 'inset 0 0 2px rgba(0, 0, 0, 40%)'}} />
                        </Slider.Track >
                        <Slider.Thumb className={styles.longitudinalSliderThumb} style={{backgroundColor: '#ED90A6'}}/>
                        <Slider.Thumb className={styles.longitudinalSliderThumb} style={{backgroundColor: '#A18AC2'}}/>
                    </Slider.Root>
                </form>
                <div className={styles.sliderLabelRow}>
                    <span className={styles.sliderDateChip} style={{background: '#fde8ee', color: '#7a1840'}}>{numToDateLabel(vals2[0])}</span>
                    <span className={styles.sliderLabelSep}>–</span>
                    <span className={styles.sliderDateChip} style={{background: '#ece5f6', color: '#3a2070'}}>{numToDateLabel(vals2[1])}</span>
                    <span className={styles.sliderDuration}>{dateRangeLabel(vals2[0], vals2[1])}</span>
                    <label className={`${styles.lockLabel} ${lockDateRange2 ? styles.lockLabelActive : ''}`} data-tooltip-id="sidebar-tooltip" data-tooltip-content="Locks the window width. Dragging either handle shifts the entire range without changing its duration.">
                        <input type="checkbox" onChange={changeLockDateRange2} defaultChecked/>
                        <FontAwesomeIcon icon={lockDateRange2 ? fas.faLock : fas.faLockOpen} widthAuto/>
                    </label>
                </div>
            </div>
        </div>
    )
}


export function MapFilters ({model, appState}: {model: Model, appState: AppStateTypes}) {
    const perCapita = appState.perCapita
    const setPerCapita = appState.setPerCapita
    const activeGroup = appState.activeGroup
    
    const showForPatients = activeGroup === 'patient'
    const showForDoctors = activeGroup === 'doctor'
    const showForCancer = activeGroup === 'cancer'

    const changePerCapita = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target) {
            if (event.target.value === 'true'){
                setPerCapita(true)
            }
            else {
                setPerCapita(false)
            }
        }
    }

    return (
        <div className={styles.filtersContainer}>
            <Tooltip id="sidebar-tooltip" place="right" style={{ maxWidth: 240, fontSize: '12px', zIndex: 1001 }} />
            <div className={styles.filterSection}>
                <span className={styles.filterSectionLabel}>Values By</span>
                <div className={styles.segmentedControl}>
                    <label className={`${styles.segmentedOption} ${perCapita === false ? styles.segmentedOptionActive : ''}`}>
                        <input type="radio" id='total' name="perCapita" value='false' checked={perCapita === false} onChange={changePerCapita}/>
                        Total Count
                    </label>
                    <label className={`${styles.segmentedOption} ${perCapita === true ? styles.segmentedOptionActive : ''}`}>
                        <input type="radio" id='perCapita' name="perCapita" value='true' checked={perCapita === true} onChange={changePerCapita}/>
                        Per Capita
                        <span className={styles.infoIcon} data-tooltip-id="sidebar-tooltip" data-tooltip-content="Normalizes counts by population (per 100,000 people), allowing fair comparison between regions of different sizes.">
                            <FontAwesomeIcon icon={fas.faCircleInfo} />
                        </span>
                    </label>
                </div>
            </div>
            < ShowDateRangeSelector model={model} appState={appState} />
            {!showForCancer && < ShowLongitudinalAnalysisSelector model={model} appState={appState} />}
            {showForCancer && < CancerTypeSelector model={model} appState={appState} />}
        </div>
    )
}

export function RankingsResultsModeSelector( {model, appState}: {model: Model, appState: AppStateTypes} ) {
    const rankingsResultsMode = appState.rankingsResultsMode
    const setRankingsResultsMode = appState.setRankingsResultsMode

    const changeRankingsResultsMode = (event: React.ChangeEvent<HTMLSelectElement>) => {
        if (event.target) {
            const newMode: rankingsResultsModeOptions = event.target.value as rankingsResultsModeOptions ?? "region"
            setRankingsResultsMode(newMode)
        }
    }

    return (
        <div className={styles.rankingsResultsModeSelector}>
            <Tooltip id="rankings-tooltip" place="left" style={{ maxWidth: 240, fontSize: '12px', zIndex: 1001, opacity: "0.5" }} />
            <label data-tooltip-id="rankings-tooltip" data-tooltip-content="Select whether to see rankings by region or by doctor"><select name="rankingsResultsMode" id="rankingsResultsMode" defaultValue={rankingsResultsMode} onChange={changeRankingsResultsMode} className={styles.rankingsResultsModeInput} required>
                <option value="regions">Regions</option>
                <option value="doctors">Doctors</option>
            </select></label>
        </div>
    )
}


// ─── Unused / inactive (entry points are commented out) ────────────────────────

export function RegionRankingsRadiusSelector({model, appState}: {model: Model, appState: AppStateTypes}) {
    const radius = appState.regionRankingsRadius
    const setRadius = appState.setRegionRankingsRadius

    const changeRadius = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target) {
            const newRadius = parseInt(event.target.value, 10)
            setRadius(newRadius ? newRadius : 0)
        }
    }

    const displayRadius = radius > 0 ? radius : ""

    return (
        <div className={styles.selectRegionRankingsRadius}>
            <label><input type="number" id='regionRankingsRadius' name="regionRankingsRadius" min="0" value={displayRadius} onChange={changeRadius} step={10} className={styles.regionRankingsRadiusInput} autoComplete="off" /> Mi</label>
        </div>
    )
}

export function LongitudinalRankingsResultsTypeSelector( {model, appState}: {model: Model, appState: AppStateTypes} ) {
    const rankingsResultsMode = appState.rankingsResultsMode
    const setRankingsResultsMode = appState.setRankingsResultsMode

    const changeRankingsResultsMode = (event: React.ChangeEvent<HTMLSelectElement>) => {
        if (event.target) {
            const newMode: rankingsResultsModeOptions = event.target.value as rankingsResultsModeOptions ?? "region"
            setRankingsResultsMode(newMode)
        }
    }

    return (
        <div className={styles.rankingsResultsModeSelector}>
            <label><select name="rankingsResultsMode" id="rankingsResultsMode" defaultValue={rankingsResultsMode} onChange={changeRankingsResultsMode} className={styles.rankingsResultsModeInput} required>
                <option value="regions">Percent</option>
                <option value="doctors">Diff.</option>
            </select></label>
        </div>
    )
}

function AdjustForCancerSelector({model, appState}: {model: Model, appState: AppStateTypes}) {
    const adjustForCancer = appState.adjustForCancer
    const setAdjustForCancer = appState.setAdjustForCancer

    const changeAdjustForCancer = (event: React.ChangeEvent<HTMLInputElement>) => {
        setAdjustForCancer(event.target.value === 'true' ? true : false)
    }

    return (
        <div className='adjustForCancer'>
            <p>View Results:</p>
                <div>
                    <label><input type="radio" id='false' name="adjustForCancer" value='false' checked={adjustForCancer === false} onChange={changeAdjustForCancer}/>Raw Data</label><br/>
                </div>
                {/* <div>
                    <label><input type="radio" id='ratio' name="adjustForCancer" value='ratio' checked={adjustForCancer === 'ratio'} onChange={changeAdjustForCancer}/>Adjusted for Cancer Rates - Ratio</label><br/>
                </div> */}
                <div>
                    <label><input type="radio" id='true' name="adjustForCancer" value='true' checked={adjustForCancer === true} onChange={changeAdjustForCancer}/>Adjusted for Cancer Rates</label><br/>
                </div>
        </div>
    )
}

function AdjustForNumReferralsSelector( {model, appState}: {model: Model, appState: AppStateTypes} ) {
    const adjustForReferrals = appState.adjustForReferrals
    const setAdjustForReferrals = appState.setAdjustForReferrals

    const changeAdjustForReferrals = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target) {
            setAdjustForReferrals(event.target.value === 'true' ? true : false)
        }
    }

    return (
        <div className='adjustForReferrals'>
            <p>View Results:</p>
                <div>
                    <label><input type="radio" id='rawData' name="adjustForReferrals" value='false' checked={adjustForReferrals === false} onChange={changeAdjustForReferrals}/>Raw Data</label><br/>
                </div>
                <div>
                    <label><input type="radio" id='true' name="adjustForReferrals" value='true' checked={adjustForReferrals === true} onChange={changeAdjustForReferrals}/>Adjusted for Patient Referrals</label><br/>
                </div>
        </div>
    )
}

function RadiusFromThisHospitalSelector({model, appState}: {model: Model, appState: AppStateTypes}) {
    const radiusFromThisHospital = appState.radiusFromThisHospital
    const setRadiusFromThisHospital = appState.setRadiusFromThisHospital

    const changeRadiusFromThisHospital = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target) {
            setRadiusFromThisHospital(parseInt(event.target.value, 10))
        }
    }

    return (
        <div className='selectRadiusFromHospital'>
            <p>Get Count Within:</p>
                <div>
                    <label><input type="number" id='hospitalRadius' name="hospitalRadius" min="1" value={radiusFromThisHospital} onChange={changeRadiusFromThisHospital}/> Miles from Hospital</label><br/>
                </div>
                < CountWithinRadius key={radiusFromThisHospital} model={model} appState={appState} />
        </div>
    )
}