/**
 * Web Dashboard HTML Generation
 * BRUTALIST DESIGN SYSTEM - Raw. Functional. Anti-corporate.
 */

import type { Env, QueryFilters, Route } from './types';
import {
  getTotalSamples,
  getIntervalData,
  getDayIntervalData,
  getRecentPairedMeasurements,
  getBestWorstSlots,
  getDateRange,
} from './queries';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTime(hour: number): string {
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m`;
}

function formatDirection(direction: string, originLabel: string, destLabel: string): string {
  return direction === 'outbound' ? `${originLabel} → ${destLabel}` : `${destLabel} → ${originLabel}`;
}

/**
 * Check if "This Week" filter is active (startDate is ~7 days ago, no endDate, no excludeHolidays, no weekdaysOnly)
 */
function isWeekFilter(filters: QueryFilters): boolean {
  if (!filters.startDate || filters.endDate || filters.excludeHolidays || filters.weekdaysOnly) {
    return false;
  }
  const startDate = new Date(filters.startDate);
  const now = new Date();
  const daysDiff = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  return daysDiff >= 6 && daysDiff <= 8; // Allow 1 day tolerance
}

/**
 * Check if "This Month" filter is active (startDate is ~30 days ago, no endDate, no excludeHolidays, no weekdaysOnly)
 */
function isMonthFilter(filters: QueryFilters): boolean {
  if (!filters.startDate || filters.endDate || filters.excludeHolidays || filters.weekdaysOnly) {
    return false;
  }
  const startDate = new Date(filters.startDate);
  const now = new Date();
  const daysDiff = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  return daysDiff >= 28 && daysDiff <= 32; // Allow 2 day tolerance for month variations
}

/**
 * Check if manual filters are active (any date range or excludeHolidays)
 * Returns true if user has set custom filters via the APPLY form
 */
function isManualFilter(filters: QueryFilters): boolean {
  // Manual filters are active if:
  // - Custom date range is set (but not a quick filter pattern)
  // - excludeHolidays is checked
  // Quick filters (week/month/weekdays) are NOT considered manual
  if (isWeekFilter(filters) || isMonthFilter(filters) || filters.weekdaysOnly) {
    return false;
  }
  return !!(filters.startDate || filters.endDate || filters.excludeHolidays);
}

export async function generateDashboard(
  env: Env,
  filters: QueryFilters,
  currentRoute: Route,
  allRoutes: Route[]
): Promise<string> {
  // Get labels from route config
  const originLabel = env.ORIGIN_LABEL || 'Origin';
  const destLabel = currentRoute.label;
  const isActiveRoute = currentRoute.active !== false;
  const originShort = originLabel.substring(0, 10);
  const destShort = destLabel.substring(0, 10);

  // Fetch all data
  const [totalSamples, intervalData, dayIntervalData, recentPaired, bestWorst, dateRange] = await Promise.all([
    getTotalSamples(env.DB, filters),
    getIntervalData(env.DB, filters),
    getDayIntervalData(env.DB, filters),
    getRecentPairedMeasurements(env.DB, filters),
    getBestWorstSlots(env.DB, filters),
    getDateRange(env.DB, filters.routeId),
  ]);

  // Prepare chart data
  const intervalChartData = JSON.stringify(intervalData);
  const dayIntervalChartData = JSON.stringify(dayIntervalData);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="900">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='%23000'/><rect x='4' y='12' width='24' height='12' fill='%23FFFF00'/><rect x='7' y='8' width='18' height='8' fill='%23FFFF00'/><rect x='8' y='22' width='6' height='6' fill='%23000'/><rect x='18' y='22' width='6' height='6' fill='%23000'/></svg>">
  <title>TRAFFIC TRACKER // ${originLabel.toUpperCase()} - ${destLabel.toUpperCase()}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Bebas+Neue&display=swap" rel="stylesheet">
  <style>
*, ::before, ::after{
  --tw-border-spacing-x:0;
  --tw-border-spacing-y:0;
  --tw-translate-x:0;
  --tw-translate-y:0;
  --tw-rotate:0;
  --tw-skew-x:0;
  --tw-skew-y:0;
  --tw-scale-x:1;
  --tw-scale-y:1;
  --tw-pan-x:;
  --tw-pan-y:;
  --tw-pinch-zoom:;
  --tw-scroll-snap-strictness:proximity;
  --tw-gradient-from-position:;
  --tw-gradient-via-position:;
  --tw-gradient-to-position:;
  --tw-ordinal:;
  --tw-slashed-zero:;
  --tw-numeric-figure:;
  --tw-numeric-spacing:;
  --tw-numeric-fraction:;
  --tw-ring-inset:;
  --tw-ring-offset-width:0px;
  --tw-ring-offset-color:#fff;
  --tw-ring-color:rgb(59 130 246 / 0.5);
  --tw-ring-offset-shadow:0 0 #0000;
  --tw-ring-shadow:0 0 #0000;
  --tw-shadow:0 0 #0000;
  --tw-shadow-colored:0 0 #0000;
  --tw-blur:;
  --tw-brightness:;
  --tw-contrast:;
  --tw-grayscale:;
  --tw-hue-rotate:;
  --tw-invert:;
  --tw-saturate:;
  --tw-sepia:;
  --tw-drop-shadow:;
  --tw-backdrop-blur:;
  --tw-backdrop-brightness:;
  --tw-backdrop-contrast:;
  --tw-backdrop-grayscale:;
  --tw-backdrop-hue-rotate:;
  --tw-backdrop-invert:;
  --tw-backdrop-opacity:;
  --tw-backdrop-saturate:;
  --tw-backdrop-sepia:;
  --tw-contain-size:;
  --tw-contain-layout:;
  --tw-contain-paint:;
  --tw-contain-style:;
}

::backdrop{
  --tw-border-spacing-x:0;
  --tw-border-spacing-y:0;
  --tw-translate-x:0;
  --tw-translate-y:0;
  --tw-rotate:0;
  --tw-skew-x:0;
  --tw-skew-y:0;
  --tw-scale-x:1;
  --tw-scale-y:1;
  --tw-pan-x:;
  --tw-pan-y:;
  --tw-pinch-zoom:;
  --tw-scroll-snap-strictness:proximity;
  --tw-gradient-from-position:;
  --tw-gradient-via-position:;
  --tw-gradient-to-position:;
  --tw-ordinal:;
  --tw-slashed-zero:;
  --tw-numeric-figure:;
  --tw-numeric-spacing:;
  --tw-numeric-fraction:;
  --tw-ring-inset:;
  --tw-ring-offset-width:0px;
  --tw-ring-offset-color:#fff;
  --tw-ring-color:rgb(59 130 246 / 0.5);
  --tw-ring-offset-shadow:0 0 #0000;
  --tw-ring-shadow:0 0 #0000;
  --tw-shadow:0 0 #0000;
  --tw-shadow-colored:0 0 #0000;
  --tw-blur:;
  --tw-brightness:;
  --tw-contrast:;
  --tw-grayscale:;
  --tw-hue-rotate:;
  --tw-invert:;
  --tw-saturate:;
  --tw-sepia:;
  --tw-drop-shadow:;
  --tw-backdrop-blur:;
  --tw-backdrop-brightness:;
  --tw-backdrop-contrast:;
  --tw-backdrop-grayscale:;
  --tw-backdrop-hue-rotate:;
  --tw-backdrop-invert:;
  --tw-backdrop-opacity:;
  --tw-backdrop-saturate:;
  --tw-backdrop-sepia:;
  --tw-contain-size:;
  --tw-contain-layout:;
  --tw-contain-paint:;
  --tw-contain-style:;
}

*,
::before,
::after{
  box-sizing:border-box;
  border-width:0;
  border-style:solid;
  border-color:#e5e7eb;
}

::before,
::after{
  --tw-content:'';
}

html,
:host{
  line-height:1.5;
  -webkit-text-size-adjust:100%;
  -moz-tab-size:4;
  -o-tab-size:4;
     tab-size:4;
  font-family:ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
  font-feature-settings:normal;
  font-variation-settings:normal;
  -webkit-tap-highlight-color:transparent;
}

body{
  margin:0;
  line-height:inherit;
}

hr{
  height:0;
  color:inherit;
  border-top-width:1px;
}

abbr:where([title]){
  -webkit-text-decoration:underline dotted;
          text-decoration:underline dotted;
}

h1,
h2,
h3,
h4,
h5,
h6{
  font-size:inherit;
  font-weight:inherit;
}

a{
  color:inherit;
  text-decoration:inherit;
}

b,
strong{
  font-weight:bolder;
}

code,
kbd,
samp,
pre{
  font-family:Space Mono, monospace;
  font-feature-settings:normal;
  font-variation-settings:normal;
  font-size:1em;
}

small{
  font-size:80%;
}

sub,
sup{
  font-size:75%;
  line-height:0;
  position:relative;
  vertical-align:baseline;
}

sub{
  bottom:-0.25em;
}

sup{
  top:-0.5em;
}

table{
  text-indent:0;
  border-color:inherit;
  border-collapse:collapse;
}

button,
input,
optgroup,
select,
textarea{
  font-family:inherit;
  font-feature-settings:inherit;
  font-variation-settings:inherit;
  font-size:100%;
  font-weight:inherit;
  line-height:inherit;
  letter-spacing:inherit;
  color:inherit;
  margin:0;
  padding:0;
}

button,
select{
  text-transform:none;
}

button,
input:where([type='button']),
input:where([type='reset']),
input:where([type='submit']){
  -webkit-appearance:button;
  background-color:transparent;
  background-image:none;
}

:-moz-focusring{
  outline:auto;
}

:-moz-ui-invalid{
  box-shadow:none;
}

progress{
  vertical-align:baseline;
}

::-webkit-inner-spin-button,
::-webkit-outer-spin-button{
  height:auto;
}

[type='search']{
  -webkit-appearance:textfield;
  outline-offset:-2px;
}

::-webkit-search-decoration{
  -webkit-appearance:none;
}

::-webkit-file-upload-button{
  -webkit-appearance:button;
  font:inherit;
}

summary{
  display:list-item;
}

blockquote,
dl,
dd,
h1,
h2,
h3,
h4,
h5,
h6,
hr,
figure,
p,
pre{
  margin:0;
}

fieldset{
  margin:0;
  padding:0;
}

legend{
  padding:0;
}

ol,
ul,
menu{
  list-style:none;
  margin:0;
  padding:0;
}
dialog{
  padding:0;
}

textarea{
  resize:vertical;
}

input::-moz-placeholder, textarea::-moz-placeholder{
  opacity:1;
  color:#9ca3af;
}

input::placeholder,
textarea::placeholder{
  opacity:1;
  color:#9ca3af;
}

button,
[role="button"]{
  cursor:pointer;
}
:disabled{
  cursor:default;
}

img,
svg,
video,
canvas,
audio,
iframe,
embed,
object{
  display:block;
  vertical-align:middle;
}

img,
video{
  max-width:100%;
  height:auto;
}
[hidden]:where(:not([hidden="until-found"])){
  display:none;
}
.container{
  width:100%;
}
@media (min-width: 640px){

  .container{
    max-width:640px;
  }
}
@media (min-width: 768px){

  .container{
    max-width:768px;
  }
}
@media (min-width: 1024px){

  .container{
    max-width:1024px;
  }
}
@media (min-width: 1280px){

  .container{
    max-width:1280px;
  }
}
@media (min-width: 1536px){

  .container{
    max-width:1536px;
  }
}
.visible{
  visibility:visible;
}
.collapse{
  visibility:collapse;
}
.absolute{
  position:absolute;
}
.relative{
  position:relative;
}
.sticky{
  position:sticky;
}
.-mx-4{
  margin-left:-1rem;
  margin-right:-1rem;
}
.mx-0{
  margin-left:0px;
  margin-right:0px;
}
.mx-auto{
  margin-left:auto;
  margin-right:auto;
}
.mb-0{
  margin-bottom:0px;
}
.mb-2{
  margin-bottom:0.5rem;
}
.mb-3{
  margin-bottom:0.75rem;
}
.mb-4{
  margin-bottom:1rem;
}
.mb-6{
  margin-bottom:1.5rem;
}
.ml-auto{
  margin-left:auto;
}
.mt-2{
  margin-top:0.5rem;
}
.mt-4{
  margin-top:1rem;
}
.mt-8{
  margin-top:2rem;
}
.block{
  display:block;
}
.inline-block{
  display:inline-block;
}
.inline{
  display:inline;
}
.flex{
  display:flex;
}
.table{
  display:table;
}
.grid{
  display:grid;
}
.contents{
  display:contents;
}
.hidden{
  display:none;
}
.h-3{
  height:0.75rem;
}
.h-4{
  height:1rem;
}
.h-48{
  height:12rem;
}
.h-5{
  height:1.25rem;
}
.h-6{
  height:1.5rem;
}
.h-64{
  height:16rem;
}
.h-72{
  height:18rem;
}
.h-8{
  height:2rem;
}
.min-h-screen{
  min-height:100vh;
}
.w-16{
  width:4rem;
}
.w-24{
  width:6rem;
}
.w-3{
  width:0.75rem;
}
.w-4{
  width:1rem;
}
.w-5{
  width:1.25rem;
}
.w-8{
  width:2rem;
}
.w-full{
  width:100%;
}
.min-w-0{
  min-width:0px;
}
.min-w-max{
  min-width:-moz-max-content;
  min-width:max-content;
}
.max-w-7xl{
  max-width:80rem;
}
.flex-1{
  flex:1 1 0%;
}
.border-collapse{
  border-collapse:collapse;
}
.transform{
  transform:translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));
}
.cursor-pointer{
  cursor:pointer;
}
.resize{
  resize:both;
}
.grid-cols-1{
  grid-template-columns:repeat(1, minmax(0, 1fr));
}
.grid-cols-2{
  grid-template-columns:repeat(2, minmax(0, 1fr));
}
.grid-cols-3{
  grid-template-columns:repeat(3, minmax(0, 1fr));
}
.flex-row{
  flex-direction:row;
}
.flex-col{
  flex-direction:column;
}
.flex-wrap{
  flex-wrap:wrap;
}
.items-end{
  align-items:flex-end;
}
.items-center{
  align-items:center;
}
.justify-center{
  justify-content:center;
}
.justify-between{
  justify-content:space-between;
}
.gap-1{
  gap:0.25rem;
}
.gap-1\\.5{
  gap:0.375rem;
}
.gap-2{
  gap:0.5rem;
}
.gap-3{
  gap:0.75rem;
}
.gap-4{
  gap:1rem;
}
.gap-6{
  gap:1.5rem;
}
.space-y-0 > :not([hidden]) ~ :not([hidden]){
  --tw-space-y-reverse:0;
  margin-top:calc(0px * calc(1 - var(--tw-space-y-reverse)));
  margin-bottom:calc(0px * var(--tw-space-y-reverse));
}
.space-y-2 > :not([hidden]) ~ :not([hidden]){
  --tw-space-y-reverse:0;
  margin-top:calc(0.5rem * calc(1 - var(--tw-space-y-reverse)));
  margin-bottom:calc(0.5rem * var(--tw-space-y-reverse));
}
.space-y-3 > :not([hidden]) ~ :not([hidden]){
  --tw-space-y-reverse:0;
  margin-top:calc(0.75rem * calc(1 - var(--tw-space-y-reverse)));
  margin-bottom:calc(0.75rem * var(--tw-space-y-reverse));
}
.space-y-4 > :not([hidden]) ~ :not([hidden]){
  --tw-space-y-reverse:0;
  margin-top:calc(1rem * calc(1 - var(--tw-space-y-reverse)));
  margin-bottom:calc(1rem * var(--tw-space-y-reverse));
}
.overflow-x-auto{
  overflow-x:auto;
}
.overflow-y-auto{
  overflow-y:auto;
}
.whitespace-nowrap{
  white-space:nowrap;
}
.border{
  border-width:1px;
}
.border-0{
  border-width:0px;
}
.border-2{
  border-width:2px;
}
.border-b{
  border-bottom-width:1px;
}
.border-b-2{
  border-bottom-width:2px;
}
.border-t-2{
  border-top-width:2px;
}
.border-t-4{
  border-top-width:4px;
}
.border-black{
  --tw-border-opacity:1;
  border-color:rgb(0 0 0 / var(--tw-border-opacity, 1));
}
.bg-black{
  --tw-bg-opacity:1;
  background-color:rgb(0 0 0 / var(--tw-bg-opacity, 1));
}
.bg-brutal-cyan{
  --tw-bg-opacity:1;
  background-color:rgb(0 255 255 / var(--tw-bg-opacity, 1));
}
.bg-brutal-green{
  --tw-bg-opacity:1;
  background-color:rgb(0 255 0 / var(--tw-bg-opacity, 1));
}
.bg-brutal-red{
  --tw-bg-opacity:1;
  background-color:rgb(255 0 0 / var(--tw-bg-opacity, 1));
}
.bg-brutal-yellow{
  --tw-bg-opacity:1;
  background-color:rgb(255 255 0 / var(--tw-bg-opacity, 1));
}
.bg-gray-200{
  --tw-bg-opacity:1;
  background-color:rgb(229 231 235 / var(--tw-bg-opacity, 1));
}
.bg-orange-500{
  --tw-bg-opacity:1;
  background-color:rgb(249 115 22 / var(--tw-bg-opacity, 1));
}
.bg-white{
  --tw-bg-opacity:1;
  background-color:rgb(255 255 255 / var(--tw-bg-opacity, 1));
}
.p-4{
  padding:1rem;
}
.p-5{
  padding:1.25rem;
}
.p-6{
  padding:1.5rem;
}
.px-0{
  padding-left:0px;
  padding-right:0px;
}
.px-1{
  padding-left:0.25rem;
  padding-right:0.25rem;
}
.px-2{
  padding-left:0.5rem;
  padding-right:0.5rem;
}
.px-3{
  padding-left:0.75rem;
  padding-right:0.75rem;
}
.px-4{
  padding-left:1rem;
  padding-right:1rem;
}
.px-6{
  padding-left:1.5rem;
  padding-right:1.5rem;
}
.py-0{
  padding-top:0px;
  padding-bottom:0px;
}
.py-0\\.5{
  padding-top:0.125rem;
  padding-bottom:0.125rem;
}
.py-1{
  padding-top:0.25rem;
  padding-bottom:0.25rem;
}
.py-1\\.5{
  padding-top:0.375rem;
  padding-bottom:0.375rem;
}
.py-2{
  padding-top:0.5rem;
  padding-bottom:0.5rem;
}
.py-3{
  padding-top:0.75rem;
  padding-bottom:0.75rem;
}
.py-4{
  padding-top:1rem;
  padding-bottom:1rem;
}
.py-6{
  padding-top:1.5rem;
  padding-bottom:1.5rem;
}
.py-8{
  padding-top:2rem;
  padding-bottom:2rem;
}
.pb-2{
  padding-bottom:0.5rem;
}
.pr-2{
  padding-right:0.5rem;
}
.pt-0{
  padding-top:0px;
}
.pt-3{
  padding-top:0.75rem;
}
.pt-4{
  padding-top:1rem;
}
.text-center{
  text-align:center;
}
.text-right{
  text-align:right;
}
.font-mono{
  font-family:Space Mono, monospace;
}
.text-2xl{
  font-size:1.5rem;
  line-height:2rem;
}
.text-3xl{
  font-size:1.875rem;
  line-height:2.25rem;
}
.text-4xl{
  font-size:2.25rem;
  line-height:2.5rem;
}
.text-base{
  font-size:1rem;
  line-height:1.5rem;
}
.text-lg{
  font-size:1.125rem;
  line-height:1.75rem;
}
.text-sm{
  font-size:0.875rem;
  line-height:1.25rem;
}
.text-xl{
  font-size:1.25rem;
  line-height:1.75rem;
}
.text-xs{
  font-size:0.75rem;
  line-height:1rem;
}
.font-bold{
  font-weight:700;
}
.uppercase{
  text-transform:uppercase;
}
.tracking-wider{
  letter-spacing:0.05em;
}
.text-black{
  --tw-text-opacity:1;
  color:rgb(0 0 0 / var(--tw-text-opacity, 1));
}
.text-brutal-red{
  --tw-text-opacity:1;
  color:rgb(255 0 0 / var(--tw-text-opacity, 1));
}
.text-brutal-yellow{
  --tw-text-opacity:1;
  color:rgb(255 255 0 / var(--tw-text-opacity, 1));
}
.text-gray-500{
  --tw-text-opacity:1;
  color:rgb(107 114 128 / var(--tw-text-opacity, 1));
}
.text-white{
  --tw-text-opacity:1;
  color:rgb(255 255 255 / var(--tw-text-opacity, 1));
}
.underline{
  text-decoration-line:underline;
}
.outline{
  outline-style:solid;
}
.filter{
  filter:var(--tw-blur) var(--tw-brightness) var(--tw-contrast) var(--tw-grayscale) var(--tw-hue-rotate) var(--tw-invert) var(--tw-saturate) var(--tw-sepia) var(--tw-drop-shadow);
}
.transition{
  transition-property:color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter;
  transition-timing-function:cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration:150ms;
}
.ease-in-out{
  transition-timing-function:cubic-bezier(0.4, 0, 0.2, 1);
}
.ease-out{
  transition-timing-function:cubic-bezier(0, 0, 0.2, 1);
}
.last\\:border-0:last-child{
  border-width:0px;
}
.last\\:pb-0:last-child{
  padding-bottom:0px;
}
.focus\\:outline-none:focus{
  outline:2px solid transparent;
  outline-offset:2px;
}
.focus\\:ring-2:focus{
  --tw-ring-offset-shadow:var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);
  --tw-ring-shadow:var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color);
  box-shadow:var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000);
}
.focus\\:ring-brutal-blue:focus{
  --tw-ring-opacity:1;
  --tw-ring-color:rgb(0 0 255 / var(--tw-ring-opacity, 1));
}
.focus\\:ring-offset-2:focus{
  --tw-ring-offset-width:2px;
}
@media (min-width: 640px){

  .sm\\:mx-0{
    margin-left:0px;
    margin-right:0px;
  }

  .sm\\:flex{
    display:flex;
  }

  .sm\\:hidden{
    display:none;
  }

  .sm\\:h-64{
    height:16rem;
  }

  .sm\\:flex-row{
    flex-direction:row;
  }

  .sm\\:items-center{
    align-items:center;
  }

  .sm\\:justify-between{
    justify-content:space-between;
  }

  .sm\\:p-5{
    padding:1.25rem;
  }

  .sm\\:px-0{
    padding-left:0px;
    padding-right:0px;
  }
}
@media (min-width: 768px){

  .md\\:ml-auto{
    margin-left:auto;
  }

  .md\\:flex{
    display:flex;
  }

  .md\\:contents{
    display:contents;
  }

  .md\\:grid-cols-3{
    grid-template-columns:repeat(3, minmax(0, 1fr));
  }

  .md\\:flex-wrap{
    flex-wrap:wrap;
  }

  .md\\:items-end{
    align-items:flex-end;
  }

  .md\\:gap-4{
    gap:1rem;
  }

  .md\\:space-y-0 > :not([hidden]) ~ :not([hidden]){
    --tw-space-y-reverse:0;
    margin-top:calc(0px * calc(1 - var(--tw-space-y-reverse)));
    margin-bottom:calc(0px * var(--tw-space-y-reverse));
  }

  .md\\:border-0{
    border-width:0px;
  }

  .md\\:pt-0{
    padding-top:0px;
  }
}
@media (min-width: 1024px){

  .lg\\:h-72{
    height:18rem;
  }

  .lg\\:grid-cols-2{
    grid-template-columns:repeat(2, minmax(0, 1fr));
  }
}

  </style>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    /* ========================================
       BRUTALIST DESIGN SYSTEM
       Raw. Functional. Anti-corporate.
       ======================================== */

    * {
      -webkit-font-smoothing: none;
    }

    body {
      font-family: 'Space Mono', monospace;
      background: #FFFFFF;
      color: #000000;
    }

    /* Brutalist Card - The foundation */
    .brutal-card {
      border: 3px solid #000;
      box-shadow: 6px 6px 0 0 #000;
      background: #fff;
    }
    .brutal-card-sm {
      border: 2px solid #000;
      box-shadow: 4px 4px 0 0 #000;
      background: #fff;
    }

    /* Brutalist Button System */
    .brutal-btn {
      border: 3px solid #000;
      box-shadow: 4px 4px 0 0 #000;
      transition: transform 0.05s ease, box-shadow 0.05s ease;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-family: 'Space Mono', monospace;
    }
    .brutal-btn:hover {
      transform: translate(-2px, -2px);
      box-shadow: 6px 6px 0 0 #000;
    }
    .brutal-btn:active {
      transform: translate(2px, 2px);
      box-shadow: 2px 2px 0 0 #000;
    }
    .brutal-btn-active {
      background: #000 !important;
      color: #FFFF00 !important;
    }
    .brutal-btn-inactive {
      background: #fff;
      color: #000;
    }
    .brutal-btn-inactive:hover {
      background: #FFFF00;
    }

    /* Brutalist Form Inputs */
    .brutal-input {
      border: 3px solid #000;
      background: #fff;
      font-family: 'Space Mono', monospace;
      font-size: 14px;
      padding: 8px 12px;
    }
    .brutal-input:focus {
      outline: none;
      background: #FFFF00;
    }

    .brutal-checkbox {
      -webkit-appearance: none;
      appearance: none;
      width: 20px;
      height: 20px;
      border: 3px solid #000;
      background: #fff;
      cursor: pointer;
      position: relative;
    }
    .brutal-checkbox:checked {
      background: #000;
    }
    .brutal-checkbox:checked::after {
      content: '\\2713';
      color: #FFFF00;
      font-size: 14px;
      font-weight: bold;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }
    .brutal-checkbox:focus {
      outline: 3px solid #FFFF00;
      outline-offset: 2px;
    }

    .brutal-select {
      border: 3px solid #000;
      background: #fff;
      font-family: 'Space Mono', monospace;
      font-size: 14px;
      padding: 8px 32px 8px 12px;
      cursor: pointer;
      -webkit-appearance: none;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 8px center;
      background-size: 16px;
    }
    .brutal-select:focus {
      outline: none;
      background-color: #FFFF00;
    }

    /* Brutalist Section Headers */
    .brutal-header {
      font-family: 'Bebas Neue', sans-serif;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      border-bottom: 4px solid #000;
      padding-bottom: 8px;
      margin-bottom: 16px;
    }

    /* Heatmap cells - Brutalist */
    .heatmap-cell {
      transition: transform 0.05s ease, box-shadow 0.05s ease;
      border: 2px solid #000 !important;
      border-radius: 0 !important;
      font-family: 'Space Mono', monospace;
      font-weight: 700;
    }
    .heatmap-cell:hover, .heatmap-cell:focus {
      transform: translate(-2px, -2px);
      z-index: 10;
      box-shadow: 4px 4px 0 0 #000;
    }

    /* Brutalist Table */
    .brutal-table {
      border-collapse: separate;
      border-spacing: 0;
      border: 3px solid #000;
      width: 100%;
    }
    .brutal-table thead {
      background: #000;
      color: #FFFF00;
    }
    .brutal-table th {
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 12px;
      text-align: left;
      border-bottom: 3px solid #000;
    }
    .brutal-table td {
      padding: 12px;
      border-bottom: 2px solid #000;
    }
    .brutal-table tbody tr:hover {
      background: #FFFF00;
    }
    .brutal-table tbody tr:last-child td {
      border-bottom: none;
    }

    /* Direction indicator arrow */
    .direction-arrow {
      font-family: 'Space Mono', monospace;
      font-size: 1.5rem;
      font-weight: 900;
      letter-spacing: -0.1em;
    }

    /* Scroll container */
    .brutal-scroll {
      scrollbar-width: thin;
      scrollbar-color: #000 #fff;
    }
    .brutal-scroll::-webkit-scrollbar {
      width: 12px;
      height: 12px;
    }
    .brutal-scroll::-webkit-scrollbar-track {
      background: #fff;
      border: 2px solid #000;
    }
    .brutal-scroll::-webkit-scrollbar-thumb {
      background: #000;
      border: 2px solid #fff;
    }

    /* Skeleton - Brutalist version */
    @keyframes brutalist-flash {
      0%, 100% { background: #fff; }
      50% { background: #000; }
    }
    .skeleton {
      background: #e5e5e5;
      border: 2px solid #000;
    }

    /* Fade in animation */
    @keyframes fadeSlideIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-row {
      animation: fadeSlideIn 0.2s ease-out forwards;
      opacity: 0;
    }

    /* Live pulse - Brutalist square version */
    @keyframes brutal-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.5); }
    }
    .brutal-pulse {
      animation: brutal-pulse 1s ease-in-out infinite;
    }

    /* Brutalist label */
    .brutal-label {
      font-family: 'Space Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #000;
    }

    /* Brutalist Color Backgrounds */
    .bg-brutal-yellow { background: #FFFF00 !important; }
    .bg-brutal-red { background: #FF0000 !important; }
    .bg-brutal-green { background: #00FF00 !important; }
    .bg-brutal-cyan { background: #00FFFF !important; }

    /* Quick filter pills - Brutalist */
    .brutal-pill {
      border: 2px solid #000;
      box-shadow: 3px 3px 0 0 #000;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      transition: transform 0.05s ease, box-shadow 0.05s ease;
    }
    .brutal-pill:hover {
      transform: translate(-1px, -1px);
      box-shadow: 4px 4px 0 0 #000;
      background: #FFFF00;
    }
    .brutal-pill:active {
      transform: translate(1px, 1px);
      box-shadow: 2px 2px 0 0 #000;
    }

    /* Archived route banner */
    .brutal-warning {
      background: #FFFF00;
      border: 3px solid #000;
      box-shadow: 4px 4px 0 0 #000;
    }

    /* Mobile adjustments */
    @media (max-width: 640px) {
      .brutal-btn {
        border-width: 2px;
        box-shadow: 3px 3px 0 0 #000;
      }
      .brutal-btn:hover {
        box-shadow: 4px 4px 0 0 #000;
      }
      .brutal-card {
        border-width: 2px;
        box-shadow: 4px 4px 0 0 #000;
      }
      .brutal-card-sm {
        box-shadow: 3px 3px 0 0 #000;
      }
      .brutal-header {
        border-bottom-width: 3px;
      }
      .brutal-table {
        border-width: 2px;
      }
      .brutal-table th,
      .brutal-table td {
        padding: 8px;
      }
    }

    /* Chart container styling */
    .brutal-chart-container {
      border: 3px solid #000;
      background: #fff;
      padding: 16px;
    }

    /* Sticky Toolbar - Brutalist Command Bar */
    .brutal-toolbar {
      position: sticky;
      top: 0;
      z-index: 1000;
      background: #000;
      color: #FFFF00;
      border-bottom: 4px solid #000;
      box-shadow: 0 4px 0 0 #000;
    }
    .brutal-toolbar.scrolled {
      box-shadow: 0 8px 0 0 #000;
    }
    .brutal-toolbar-btn {
      border: 2px solid #FFFF00;
      background: #000;
      color: #FFFF00;
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      transition: all 0.05s ease;
    }
    .brutal-toolbar-btn:hover {
      background: #FFFF00;
      color: #000;
    }
    .brutal-toolbar-btn-active {
      background: #FFFF00;
      color: #000;
      border-color: #000;
    }
    .brutal-toolbar-select {
      border: 2px solid #FFFF00;
      background: #000;
      color: #FFFF00;
      font-family: 'Space Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      padding: 6px 8px;
      cursor: pointer;
    }
    .brutal-toolbar-select option {
      background: #000;
      color: #FFFF00;
    }
  </style>
</head>
<body class="min-h-screen bg-white font-mono">
  <!-- STICKY BRUTALIST TOOLBAR -->
  <div class="brutal-toolbar" id="brutalToolbar">
    <div class="container mx-auto px-4 max-w-7xl">
      <!-- Mobile Layout: Single Line -->
      <div class="sm:hidden py-2">
        <div class="flex items-center justify-between gap-1.5 text-xs">
          <!-- Left: Route (compact) -->
          ${allRoutes.length > 1 ? `
          <select id="routeSelect" onchange="window.location.href='/traffic/route/' + this.value + window.location.search"
            class="brutal-toolbar-select text-xs px-1 py-0.5 min-w-0">
            ${allRoutes.map(r => `<option value="${r.id}" ${r.id === currentRoute.id ? 'selected' : ''}>${r.label.toUpperCase()}</option>`).join('')}
          </select>
          ` : `<span class="font-bold whitespace-nowrap">${destLabel.toUpperCase()}</span>`}

          <!-- Center: Direction Controls (compact) -->
          <div class="flex items-center gap-1" role="radiogroup" aria-label="Select travel direction">
            <button
              type="button"
              id="globalDirOutbound"
              onclick="setGlobalDirection('outbound')"
              role="radio"
              aria-checked="${filters.direction === 'outbound' ? 'true' : 'false'}"
              class="brutal-toolbar-btn text-xs px-2 py-0.5 ${filters.direction === 'outbound' ? 'brutal-toolbar-btn-active' : ''}">
              OUTBOUND
            </button>
            <button
              type="button"
              id="globalDirInbound"
              onclick="setGlobalDirection('inbound')"
              role="radio"
              aria-checked="${filters.direction === 'inbound' ? 'true' : 'false'}"
              class="brutal-toolbar-btn text-xs px-2 py-0.5 ${filters.direction === 'inbound' ? 'brutal-toolbar-btn-active' : ''}">
              INBOUND
            </button>
          </div>

          <!-- Right: Timezone -->
          <span class="font-bold tracking-wider whitespace-nowrap">ET</span>
        </div>
      </div>

      <!-- Desktop Layout: Horizontal -->
      <div class="hidden sm:flex items-center justify-between py-3 gap-4">
        <!-- Left: Branding + Route -->
        <div class="flex items-center gap-3">
          <span class="text-lg font-bold tracking-wider">▓ TRAFFIC</span>
          <span class="text-brutal-yellow">│</span>
          ${allRoutes.length > 1 ? `
          <select id="routeSelect" onchange="window.location.href='/traffic/route/' + this.value + window.location.search"
            class="brutal-toolbar-select">
            ${allRoutes.map(r => `<option value="${r.id}" ${r.id === currentRoute.id ? 'selected' : ''}>${r.label.toUpperCase()}${r.active === false ? ' [ARCHIVED]' : ''}</option>`).join('')}
          </select>
          ` : `<span class="font-bold">${destLabel.toUpperCase()}</span>`}
          ${!isActiveRoute ? `<span class="text-brutal-red font-bold text-sm">[ARCHIVED]</span>` : ''}
        </div>

        <!-- Center: Direction Controls -->
        <div class="flex items-center gap-2" role="radiogroup" aria-label="Select travel direction">
          <button
            type="button"
            id="globalDirOutbound"
            onclick="setGlobalDirection('outbound')"
            role="radio"
            aria-checked="${filters.direction === 'outbound' ? 'true' : 'false'}"
            class="brutal-toolbar-btn ${filters.direction === 'outbound' ? 'brutal-toolbar-btn-active' : ''}">
            OUTBOUND
          </button>
          <button
            type="button"
            id="globalDirInbound"
            onclick="setGlobalDirection('inbound')"
            role="radio"
            aria-checked="${filters.direction === 'inbound' ? 'true' : 'false'}"
            class="brutal-toolbar-btn ${filters.direction === 'inbound' ? 'brutal-toolbar-btn-active' : ''}">
            INBOUND
          </button>
        </div>

        <!-- Right: Timezone -->
        <div class="flex items-center gap-2">
          <span class="text-brutal-yellow">│</span>
          <span class="text-xs font-bold tracking-wider">ET</span>
        </div>
      </div>
    </div>
  </div>

  <div class="container mx-auto px-4 py-6 max-w-7xl">

    <!-- Filters - Brutalist -->
    <div class="brutal-card p-4 mb-6">
      <div class="brutal-header text-lg">FILTERS</div>
      <form id="filterForm" class="space-y-4 md:space-y-0 md:flex md:flex-wrap md:gap-4 md:items-end">
        <div class="grid grid-cols-2 gap-4 md:contents">
          <div>
            <label for="startDate" class="brutal-label block mb-2">START DATE</label>
            <input type="date" name="startDate" id="startDate"
              value="${filters.startDate || ''}"
              min="${dateRange.min || ''}"
              max="${dateRange.max || ''}"
              class="brutal-input w-full">
          </div>
          <div>
            <label for="endDate" class="brutal-label block mb-2">END DATE</label>
            <input type="date" name="endDate" id="endDate"
              value="${filters.endDate || ''}"
              min="${dateRange.min || ''}"
              max="${dateRange.max || ''}"
              class="brutal-input w-full">
          </div>
        </div>
        <input type="hidden" name="direction" id="direction" value="${filters.direction || 'outbound'}">
        <div class="flex items-center gap-3">
          <input type="checkbox" name="excludeHolidays" id="excludeHolidays"
            ${filters.excludeHolidays ? 'checked' : ''}
            class="brutal-checkbox">
          <label for="excludeHolidays" class="brutal-label cursor-pointer">EXCLUDE HOLIDAYS</label>
        </div>
        <div class="flex gap-2">
          <button type="submit"
            class="brutal-btn brutal-btn-inactive px-6 py-2 text-sm ${isManualFilter(filters) ? 'bg-brutal-yellow' : 'bg-white'}">
            APPLY
          </button>
          <button type="button" onclick="resetFilters()"
            class="brutal-btn brutal-btn-inactive px-6 py-2 text-sm">
            RESET
          </button>
        </div>
        <div class="flex flex-wrap gap-2 pt-3 border-t-2 border-black md:border-0 md:pt-0 md:ml-auto">
          <button type="button" onclick="setQuickFilter('week')"
            class="brutal-pill px-3 py-1.5 text-xs ${isWeekFilter(filters) ? 'bg-brutal-yellow' : 'bg-white'}">
            THIS WEEK
          </button>
          <button type="button" onclick="setQuickFilter('month')"
            class="brutal-pill px-3 py-1.5 text-xs ${isMonthFilter(filters) ? 'bg-brutal-yellow' : 'bg-white'}">
            THIS MONTH
          </button>
          <button type="button" onclick="setQuickFilter('weekdays')"
            class="brutal-pill px-3 py-1.5 text-xs ${filters.weekdaysOnly ? 'bg-brutal-yellow' : 'bg-white'}">
            WEEKDAYS
          </button>
        </div>
      </form>
    </div>

    <!-- Summary Cards - Brutalist -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <!-- Current Estimate -->
      <div class="brutal-card p-4 sm:p-5">
        <div class="brutal-header text-base">CURRENT ESTIMATE</div>
        <div id="currentEstimate">
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <div class="h-4 w-24 skeleton"></div>
              <div class="h-6 w-16 skeleton"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Best Times -->
      <div class="brutal-card p-4 sm:p-5">
        <div class="brutal-header text-base flex items-center gap-2">
          <span class="text-2xl">&#9650;</span> BEST TIMES
        </div>
        ${
          bestWorst.best.length > 0
            ? `<ul class="space-y-2">
            ${bestWorst.best
              .map(
                (slot) => `
              <li class="flex justify-between items-center border-b-2 border-black pb-2 last:border-0 last:pb-0">
                <span class="brutal-label">${DAY_NAMES[slot.day_of_week].toUpperCase()} ${formatTime(slot.hour).toUpperCase()}</span>
                <span class="font-bold text-lg bg-brutal-green px-2 py-1 border-2 border-black">${formatDuration(slot.avg_minutes)}</span>
              </li>
            `
              )
              .join('')}
          </ul>`
            : '<p class="brutal-label text-center py-4">NO DATA YET</p>'
        }
      </div>

      <!-- Worst Times -->
      <div class="brutal-card p-4 sm:p-5">
        <div class="brutal-header text-base flex items-center gap-2">
          <span class="text-2xl">&#9660;</span> WORST TIMES
        </div>
        ${
          bestWorst.worst.length > 0
            ? `<ul class="space-y-2">
            ${bestWorst.worst
              .map(
                (slot) => `
              <li class="flex justify-between items-center border-b-2 border-black pb-2 last:border-0 last:pb-0">
                <span class="brutal-label">${DAY_NAMES[slot.day_of_week].toUpperCase()} ${formatTime(slot.hour).toUpperCase()}</span>
                <span class="font-bold text-lg bg-brutal-red text-white px-2 py-1 border-2 border-black">${formatDuration(slot.avg_minutes)}</span>
              </li>
            `
              )
              .join('')}
          </ul>`
            : '<p class="brutal-label text-center py-4">NO DATA YET</p>'
        }
      </div>
    </div>

    <!-- Charts and Recent - Brutalist -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <!-- Hourly Average Chart -->
      <div class="brutal-card p-4 sm:p-5">
        <div class="brutal-header text-lg">AVG DURATION BY TIME</div>
        <div class="brutal-chart-container h-48 sm:h-64 lg:h-72" role="img" aria-label="Line chart showing average travel duration by hour of day">
          <canvas id="hourlyChart"></canvas>
        </div>
      </div>

      <!-- Recent Measurements -->
      <div class="brutal-card p-4 sm:p-5">
        <div class="brutal-header text-lg">RECENT MEASUREMENTS</div>
        ${
          recentPaired.length > 0
            ? `
        <div class="overflow-y-auto brutal-scroll" style="max-height: 18rem;">
          <table class="brutal-table">
            <thead>
              <tr>
                <th>TIME (ET)</th>
                <th class="text-right">DURATION</th>
              </tr>
            </thead>
            <tbody>
              ${recentPaired
                .map(
                  (m, i) => {
                    const duration = filters.direction === 'inbound' ? m.inbound_seconds : m.outbound_seconds;
                    return duration ? `
                <tr class="animate-row" style="animation-delay: ${i * 30}ms">
                  <td class="relative-time brutal-label" data-time="${m.measured_at_local}">${formatLocalTime(m.measured_at_local)}</td>
                  <td class="text-right">
                    <span class="font-bold bg-white px-2 py-1 border-2 border-black">${formatDuration(duration / 60)}</span>
                  </td>
                </tr>
              ` : '';
                  }
                )
                .join('')}
            </tbody>
          </table>
        </div>
        `
            : '<p class="brutal-label text-center py-8">NO MEASUREMENTS YET</p>'
        }
      </div>
    </div>

    <!-- Analytics Section - Brutalist -->
    <div id="analyticsSection" class="brutal-card p-6 mb-6 bg-brutal-yellow" style="background: #FFFF00;">
      <div class="brutal-header text-xl flex items-center gap-3" style="border-color: #000;">
        <span class="text-3xl">[*]</span> ADVANCED ANALYTICS
      </div>
      <div id="analyticsContent">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <!-- Reliability Card -->
          <div class="brutal-card-sm p-4">
            <h4 class="brutal-label mb-3 border-b-2 border-black pb-2">RELIABILITY</h4>
            <div id="reliabilityStats" class="space-y-2"></div>
          </div>
          <!-- Traffic Patterns Card -->
          <div class="brutal-card-sm p-4">
            <h4 class="brutal-label mb-3 border-b-2 border-black pb-2">TRAFFIC PATTERNS</h4>
            <div id="trafficPatterns" class="space-y-2"></div>
          </div>
          <!-- Statistical Summary Card -->
          <div class="brutal-card-sm p-4">
            <h4 class="brutal-label mb-3 border-b-2 border-black pb-2">STATISTICS</h4>
            <div id="statisticalSummary" class="space-y-2"></div>
          </div>
        </div>
        <!-- Hourly Variance Chart -->
        <div class="brutal-card-sm p-4">
          <h4 class="brutal-label mb-3 border-b-2 border-black pb-2">MOST UNPREDICTABLE HOURS</h4>
          <div class="brutal-chart-container h-64">
            <canvas id="varianceChart"></canvas>
          </div>
        </div>
      </div>
      <div id="analyticsLoading" class="hidden text-center py-8">
        <div class="inline-block w-8 h-8 bg-black brutal-pulse"></div>
        <p class="brutal-label mt-2">ANALYZING DATA...</p>
      </div>
    </div>

    <!-- Heatmap - Brutalist -->
    <div class="brutal-card p-4 sm:p-5 mb-6">
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
        <div class="brutal-header text-lg mb-0" style="border: none; padding: 0;">DAY // HOUR HEATMAP</div>
        <div class="flex gap-2">
          <button onclick="setDataSource('actual')" id="actualDataBtn"
            class="brutal-pill px-3 py-1.5 text-xs bg-brutal-yellow">
            ACTUAL DATA
          </button>
          <button onclick="setDataSource('predictions')" id="predictionsBtn"
            class="brutal-pill px-3 py-1.5 text-xs bg-white">
            PREDICTIONS
          </button>
        </div>
      </div>
      <div id="heatmapContainer" class="overflow-x-auto brutal-scroll -mx-4 px-4 sm:mx-0 sm:px-0">
        <div id="heatmap" class="min-w-max" role="grid" aria-label="Heatmap showing travel times by day and hour"></div>
      </div>
      <div class="flex justify-center items-center gap-2 mt-4">
        <span class="brutal-label">FAST</span>
        <div class="w-5 h-5 bg-brutal-green border-2 border-black"></div>
        <div class="w-5 h-5 bg-brutal-cyan border-2 border-black"></div>
        <div class="w-5 h-5 bg-brutal-yellow border-2 border-black"></div>
        <div class="w-5 h-5 bg-orange-500 border-2 border-black"></div>
        <div class="w-5 h-5 bg-brutal-red border-2 border-black"></div>
        <span class="brutal-label">SLOW</span>
      </div>
    </div>

    <!-- Footer - Brutalist -->
    <footer class="mt-8 pt-4 border-t-4 border-black">
      <div class="flex flex-col sm:flex-row justify-between items-center gap-2">
        <p class="brutal-label">
          ${totalSamples.toLocaleString()} MEASUREMENTS ${formatDateRange(dateRange.min, dateRange.max).toUpperCase()}
        </p>
        <a href="https://github.com/hirefrank/traffic-tracker" target="_blank" rel="noopener noreferrer"
           class="brutal-btn brutal-btn-inactive px-4 py-2 text-xs">
          VIEW ON GITHUB &#8599;
        </a>
      </div>
    </footer>
  </div>

  <script>
    // Data from server
    const intervalData = ${intervalChartData};
    const dayIntervalData = ${dayIntervalChartData};
    const originLabel = '${originShort}';
    const destLabel = '${destShort}';
    const routeId = '${currentRoute.id}';
    const isActiveRoute = ${isActiveRoute};

    // Global direction state
    const globalDirection = '${filters.direction || 'outbound'}';

    // Brutalist Chart.js defaults
    Chart.defaults.font.family = "'Space Mono', monospace";
    Chart.defaults.font.weight = 'bold';
    Chart.defaults.color = '#000';
    Chart.defaults.borderColor = '#000';

    // Set global direction
    function setGlobalDirection(direction) {
      const params = new URLSearchParams(window.location.search);
      params.set('direction', direction);
      window.location.href = '/traffic/route/' + routeId + '?' + params.toString();
    }

    // Initialize interval chart - BRUTALIST STYLE
    function initIntervalChart() {
      const ctx = document.getElementById('hourlyChart').getContext('2d');
      const filteredData = intervalData.filter(d => d.direction === globalDirection);
      const timeSlots = [...new Set(filteredData.map(d => d.hour * 60 + d.minute))].sort((a, b) => a - b);

      const chartData = timeSlots.map(slot => {
        const hour = Math.floor(slot / 60);
        const minute = slot % 60;
        const item = filteredData.find(d => d.hour === hour && d.minute === minute);
        return item ? item.avg_minutes : null;
      });

      const labels = timeSlots.map(slot => {
        const hour = Math.floor(slot / 60);
        const minute = slot % 60;
        if (minute === 0) return formatHour(hour);
        const h = hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour);
        return h + ':' + (minute < 10 ? '0' : '') + minute;
      });

      // Brutalist colors - blue for all directions
      const chartColor = '#0000FF';
      const chartBgColor = 'rgba(0, 0, 255, 0.2)';
      const chartLabel = globalDirection === 'outbound'
        ? originLabel.toUpperCase() + ' >>> ' + destLabel.toUpperCase()
        : destLabel.toUpperCase() + ' >>> ' + originLabel.toUpperCase();

      new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: chartLabel,
            data: chartData,
            borderColor: chartColor,
            backgroundColor: chartBgColor,
            tension: 0,  // Sharp lines, no curves
            fill: true,
            borderWidth: 3,
            pointBackgroundColor: '#000',
            pointBorderColor: chartColor,
            pointBorderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              labels: {
                font: { weight: 'bold', size: 11 },
                boxWidth: 20,
                boxHeight: 3,
                padding: 15,
              }
            },
          },
          scales: {
            x: {
              ticks: {
                maxRotation: 45,
                minRotation: 0,
                autoSkip: true,
                maxTicksLimit: 12,
                font: { weight: 'bold' },
              },
              grid: {
                color: '#000',
                lineWidth: 1,
              },
              border: {
                color: '#000',
                width: 3,
              }
            },
            y: {
              beginAtZero: false,
              title: {
                display: true,
                text: 'MINUTES',
                font: { weight: 'bold', size: 11 },
              },
              grid: {
                color: '#000',
                lineWidth: 1,
              },
              border: {
                color: '#000',
                width: 3,
              },
              ticks: {
                font: { weight: 'bold' },
              }
            },
          },
        },
      });
    }

    // Load current estimate - BRUTALIST STYLE
    async function loadCurrentEstimate() {
      const container = document.getElementById('currentEstimate');

      if (!isActiveRoute) {
        container.innerHTML = \`
          <div class="text-center py-4">
            <div class="brutal-warning inline-block px-4 py-2 mb-2">
              <span class="brutal-label">ARCHIVED</span>
            </div>
            <p class="brutal-label">NO LIVE DATA</p>
          </div>
        \`;
        return;
      }

      try {
        const res = await fetch('/traffic/api/current?routeId=' + routeId);
        const data = await res.json();

        if (data.error) {
          container.innerHTML = '<div class="bg-brutal-red text-white border-2 border-black px-4 py-2"><span class="brutal-label">ERROR LOADING</span></div>';
          return;
        }

        const currentData = globalDirection === 'outbound' ? data.outbound : data.inbound;
        const dirLabel = globalDirection === 'outbound'
          ? originLabel.toUpperCase() + ' >>> ' + destLabel.toUpperCase()
          : destLabel.toUpperCase() + ' >>> ' + originLabel.toUpperCase();

        container.innerHTML = \`
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 bg-brutal-yellow brutal-pulse border-2 border-black"></span>
              <span class="brutal-label">LIVE</span>
            </div>
            <div class="text-center py-3 bg-white border-3 border-black" style="border-width: 3px;">
              <span class="text-4xl font-bold font-mono">\${currentData ? formatDurationHM(currentData.duration_minutes) : 'N/A'}</span>
            </div>
            <div class="brutal-label text-center">\${dirLabel}</div>
          </div>
        \`;
      } catch (e) {
        container.innerHTML = '<div class="bg-brutal-red text-white border-2 border-black px-4 py-2"><span class="brutal-label">ERROR LOADING</span></div>';
      }
    }

    function formatHour(hour) {
      if (hour === 0) return '12AM';
      if (hour === 12) return '12PM';
      if (hour < 12) return hour + 'AM';
      return (hour - 12) + 'PM';
    }

    // Filter handling
    document.getElementById('filterForm').addEventListener('submit', function(e) {
      e.preventDefault();
      applyFilters();
    });

    function applyFilters() {
      const params = new URLSearchParams();
      const startDate = document.getElementById('startDate').value;
      const endDate = document.getElementById('endDate').value;
      const direction = document.getElementById('direction').value;
      const excludeHolidays = document.getElementById('excludeHolidays').checked;

      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (direction) params.set('direction', direction);
      if (excludeHolidays) params.set('excludeHolidays', 'true');

      window.location.href = '/traffic/route/' + routeId + '?' + params.toString();
    }

    function resetFilters() {
      window.location.href = '/traffic/route/' + routeId;
    }

    function setQuickFilter(type) {
      const now = new Date();
      const params = new URLSearchParams(window.location.search);

      if (type === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        params.set('startDate', weekAgo.toISOString().split('T')[0]);
        params.delete('endDate');
        params.delete('excludeHolidays');
        params.delete('weekdaysOnly');
      } else if (type === 'month') {
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        params.set('startDate', monthAgo.toISOString().split('T')[0]);
        params.delete('endDate');
        params.delete('excludeHolidays');
        params.delete('weekdaysOnly');
      } else if (type === 'weekdays') {
        params.delete('startDate');
        params.delete('endDate');
        params.delete('excludeHolidays');
        params.set('weekdaysOnly', 'true');
      }

      window.location.href = '/traffic/route/' + routeId + '?' + params.toString();
    }

    function formatRelativeTime(isoString) {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);
      const remainingMins = diffMins % 60;

      if (diffMins < 1) return 'JUST NOW';
      if (diffMins < 60) return diffMins + 'M AGO';
      if (diffHours < 24) {
        if (remainingMins === 0) return diffHours + 'H AGO';
        return diffHours + 'H ' + remainingMins + 'M AGO';
      }
      if (diffDays === 1) return 'YESTERDAY';
      return diffDays + 'D AGO';
    }

    function formatDurationHM(totalMins) {
      const hrs = Math.floor(totalMins / 60);
      const mins = Math.round(totalMins % 60);
      if (hrs > 0) return hrs + 'h ' + mins + 'm';
      return mins + 'm';
    }

    function updateRelativeTimes() {
      document.querySelectorAll('.relative-time').forEach(el => {
        const time = el.getAttribute('data-time');
        if (time) {
          el.textContent = formatRelativeTime(time);
        }
      });
    }

    // Analytics
    let analyticsData = null;
    let varianceChartInstance = null;
    let currentDataSource = 'actual';
    let predictionData = null;

    async function loadAnalytics() {
      const loading = document.getElementById('analyticsLoading');
      loading.classList.remove('hidden');

      try {
        const params = new URLSearchParams(window.location.search);
        params.set('routeId', routeId);
        const url = '/traffic/api/analytics?' + params.toString();
        console.log('Fetching analytics from:', url);
        const res = await fetch(url);

        console.log('Analytics response status:', res.status);
        if (!res.ok) {
          const errorText = await res.text();
          console.error('Analytics error response:', errorText);
          throw new Error('API returned ' + res.status + ': ' + res.statusText);
        }

        analyticsData = await res.json();
        console.log('Analytics data loaded:', analyticsData);
        renderAnalytics();
      } catch (error) {
        console.error('Analytics error:', error);
        document.getElementById('analyticsContent').innerHTML =
          '<div class="brutal-card-sm p-4 text-center"><span class="brutal-label">FAILED TO LOAD ANALYTICS: ' + error.message + '</span></div>';
      } finally {
        loading.classList.add('hidden');
      }
    }

    function renderAnalytics() {
      if (!analyticsData) return;

      // Reliability Stats - BRUTALIST
      const reliabilityMetrics = analyticsData.reliability_metrics || [];
      const directionReliability = reliabilityMetrics
        .filter(m => m.direction === globalDirection && m.confidence_level >= 80)
        .slice(0, 5);

      let reliabilityHtml = '';

      if (directionReliability.length > 0) {
        reliabilityHtml = directionReliability.map(m => \`
          <div class="flex justify-between items-center text-sm mb-2 border-b border-black pb-2 last:border-0">
            <span class="brutal-label">\${m.confidence_level}% OF TRIPS</span>
            <span class="font-bold bg-white px-2 py-1 border-2 border-black">&lt; \${formatDurationHM(m.duration_minutes)}</span>
          </div>
        \`).join('');
      }

      document.getElementById('reliabilityStats').innerHTML = reliabilityHtml || '<p class="brutal-label text-center py-2">NOT ENOUGH DATA</p>';

      // Traffic Patterns - BRUTALIST (5-color gradient like heatmap)
      const trafficPatterns = analyticsData.traffic_patterns || [];
      const patternsHtml = trafficPatterns
        .map(p => {
          const colors = {
            very_fast: 'bg-brutal-green',
            fast: 'bg-brutal-cyan',
            moderate: 'bg-brutal-yellow',
            slow: 'bg-orange-500',
            very_slow: 'bg-brutal-red text-white'
          };
          return \`
            <div class="flex items-center gap-2 text-sm mb-2">
              <div class="w-4 h-4 \${colors[p.pattern_type]} border-2 border-black"></div>
              <span class="brutal-label flex-1">\${p.pattern_type.toUpperCase().replace(/_/g, ' ')}</span>
              <span class="font-bold">\${p.percentage}%</span>
            </div>
          \`;
        }).join('');
      document.getElementById('trafficPatterns').innerHTML = patternsHtml || '<p class="brutal-label text-center py-2">NOT ENOUGH DATA</p>';

      // Statistical Summary - BRUTALIST
      const statSummary = analyticsData.statistical_summary || [];
      const directionStats = statSummary.find(s => s.direction === globalDirection);

      if (directionStats) {
        const summaryHtml = \`
          <div class="space-y-2 text-sm">
            <div class="flex justify-between border-b border-black pb-2">
              <span class="brutal-label">MEDIAN (P50)</span>
              <span class="font-bold">\${formatDurationHM(directionStats.median_minutes)}</span>
            </div>
            <div class="flex justify-between border-b border-black pb-2">
              <span class="brutal-label">P90</span>
              <span class="font-bold">\${formatDurationHM(directionStats.p90_minutes)}</span>
            </div>
            <div class="flex justify-between border-b border-black pb-2">
              <span class="brutal-label">STD DEV</span>
              <span class="font-bold">\${formatDurationHM(directionStats.std_dev_minutes)}</span>
            </div>
            <div class="flex justify-between">
              <span class="brutal-label">VARIABILITY</span>
              <span class="font-bold">\${(directionStats.coefficient_of_variation * 100).toFixed(1)}%</span>
            </div>
          </div>
        \`;
        document.getElementById('statisticalSummary').innerHTML = summaryHtml;
      } else {
        document.getElementById('statisticalSummary').innerHTML = '<p class="brutal-label text-center py-2">NOT ENOUGH DATA</p>';
      }

      renderVarianceChart();
    }

    function renderVarianceChart() {
      if (!analyticsData || !analyticsData.hourly_variance) return;

      const ctx = document.getElementById('varianceChart').getContext('2d');
      const variance = analyticsData.hourly_variance
        .filter(v => v.direction === globalDirection)
        .slice(0, 10);

      if (varianceChartInstance) {
        varianceChartInstance.destroy();
      }

      const barColor = '#0000FF';  // Blue for all directions

      varianceChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: variance.map(v => formatHour(v.hour)),
          datasets: [{
            label: 'STD DEVIATION (MIN)',
            data: variance.map(v => v.std_dev_minutes),
            backgroundColor: variance.map(v =>
              v.coefficient_of_variation > 0.3 ? '#FF0000' :
              v.coefficient_of_variation > 0.2 ? '#FFA500' : barColor
            ),
            borderColor: '#000',
            borderWidth: 3,
            borderRadius: 0,  // Sharp corners
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: {
              display: true,
              text: 'HIGHER BARS = MORE UNPREDICTABLE',
              font: { weight: 'bold', size: 11 },
            }
          },
          scales: {
            x: {
              grid: {
                color: '#000',
                lineWidth: 1,
              },
              border: {
                color: '#000',
                width: 3,
              },
              ticks: {
                font: { weight: 'bold' },
              }
            },
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'STD DEV (MIN)',
                font: { weight: 'bold', size: 11 },
              },
              grid: {
                color: '#000',
                lineWidth: 1,
              },
              border: {
                color: '#000',
                width: 3,
              },
              ticks: {
                font: { weight: 'bold' },
              }
            }
          }
        }
      });
    }

    // Prediction data toggle - BRUTALIST (dual button radio style)
    async function setDataSource(source) {
      // Don't do anything if clicking the already active button
      if (currentDataSource === source) return;

      const actualBtn = document.getElementById('actualDataBtn');
      const predictionsBtn = document.getElementById('predictionsBtn');

      if (source === 'predictions') {
        // Switching to predictions
        if (!predictionData) {
          try {
            const res = await fetch('/traffic/api/predictions/heatmap?routeId=' + routeId + '&model=best_guess');
            const data = await res.json();
            predictionData = data.heatmap_data;
          } catch (error) {
            alert('FAILED TO LOAD PREDICTIONS');
            return;
          }
        }

        currentDataSource = 'predictions';
        actualBtn.classList.remove('bg-brutal-yellow');
        actualBtn.classList.add('bg-white');
        predictionsBtn.classList.remove('bg-white');
        predictionsBtn.classList.add('bg-brutal-yellow');
      } else {
        // Switching to actual
        currentDataSource = 'actual';
        predictionsBtn.classList.remove('bg-brutal-yellow');
        predictionsBtn.classList.add('bg-white');
        actualBtn.classList.remove('bg-white');
        actualBtn.classList.add('bg-brutal-yellow');
      }

      initHeatmap(globalDirection, currentDataSource === 'predictions' ? predictionData : null);
    }

    // Heatmap - BRUTALIST
    function initHeatmap(direction, customData) {
      const container = document.getElementById('heatmap');
      const data = customData || dayIntervalData.filter(d => d.direction === direction);

      if (data.length === 0) {
        container.innerHTML = '<p class="brutal-label py-8 text-center">NOT ENOUGH DATA FOR HEATMAP</p>';
        return;
      }

      const days = [0, 1, 2, 3, 4, 5, 6];
      const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const timeSlots = [...new Set(data.map(d => d.hour * 60 + d.minute))].sort((a, b) => a - b);

      const allValues = data.map(d => d.avg_minutes).sort((a, b) => a - b);
      const q1 = allValues[Math.floor(allValues.length * 0.25)] || 0;
      const q2 = allValues[Math.floor(allValues.length * 0.5)] || 0;
      const q3 = allValues[Math.floor(allValues.length * 0.75)] || 0;

      function getColorClasses(value) {
        if (value <= q1) return { bg: 'bg-brutal-green', text: 'text-black' };
        if (value <= q2) return { bg: 'bg-brutal-cyan', text: 'text-black' };
        if (value <= q3) return { bg: 'bg-brutal-yellow', text: 'text-black' };
        if (value <= q3 + (q3 - q2)) return { bg: 'bg-orange-500', text: 'text-black' };
        return { bg: 'bg-brutal-red', text: 'text-white' };
      }

      function formatTimeSlot(slot) {
        const hour = Math.floor(slot / 60);
        const minute = slot % 60;
        const h = hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour);
        const suffix = hour < 12 ? 'A' : 'P';
        return h + ':' + (minute < 10 ? '0' : '') + minute + suffix;
      }

      let html = '<div class="grid gap-1" style="grid-template-columns: 60px repeat(7, minmax(52px, 1fr));">';

      // Header row
      html += '<div class="brutal-label text-xs"></div>';
      for (const day of days) {
        html += \`<div class="brutal-label text-xs text-center py-2 bg-black text-white border-2 border-black">\${dayNames[day]}</div>\`;
      }

      // Data rows
      for (const slot of timeSlots) {
        const hour = Math.floor(slot / 60);
        const minute = slot % 60;
        html += \`<div class="brutal-label text-xs text-right pr-2 py-2 bg-black text-white border-2 border-black">\${formatTimeSlot(slot)}</div>\`;
        for (const day of days) {
          const item = data.find(d => d.day_of_week === day && d.hour === hour && d.minute === minute);
          if (item) {
            const colors = getColorClasses(item.avg_minutes);
            const duration = formatDurationHM(Math.round(item.avg_minutes));
            html += \`<button type="button"
              class="heatmap-cell \${colors.bg} \${colors.text} text-center text-xs py-2 font-bold
                     focus:outline-none focus:ring-2 focus:ring-brutal-blue focus:ring-offset-2"
              aria-label="\${dayNames[day]} at \${formatTimeSlot(slot)}: \${duration} average, \${item.sample_count} samples">
              \${duration}
            </button>\`;
          } else {
            html += '<div class="bg-gray-200 border-2 border-black text-center text-xs py-2 font-bold text-gray-500">-</div>';
          }
        }
      }

      html += '</div>';
      container.innerHTML = html;
    }

    // Toolbar scroll effect
    window.addEventListener('scroll', function() {
      const toolbar = document.getElementById('brutalToolbar');
      if (window.scrollY > 0) {
        toolbar.classList.add('scrolled');
      } else {
        toolbar.classList.remove('scrolled');
      }
    });

    // Initialize
    document.addEventListener('DOMContentLoaded', function() {
      initIntervalChart();
      initHeatmap(globalDirection);
      loadCurrentEstimate();
      loadAnalytics();
      updateRelativeTimes();
    });
  </script>
</body>
</html>`;
}

function formatLocalTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).toUpperCase();
}

function formatDateRange(min: string | null, max: string | null): string {
  if (!min || !max) return '';

  const formatDate = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (min === max) {
    return `since ${formatDate(min)}`;
  }
  return `from ${formatDate(min)} to ${formatDate(max)}`;
}
