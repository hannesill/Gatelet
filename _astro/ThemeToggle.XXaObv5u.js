import{c as o,j as t,a as d}from"./utils.FeB9bGFv.js";import{r as n}from"./index.DiEladB3.js";/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m=[["rect",{width:"20",height:"14",x:"2",y:"3",rx:"2",key:"48i651"}],["line",{x1:"8",x2:"16",y1:"21",y2:"21",key:"1svkeh"}],["line",{x1:"12",x2:"12",y1:"17",y2:"21",key:"vw1qmm"}]],l=o("Monitor",m);/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h=[["path",{d:"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z",key:"a7tn18"}]],k=o("Moon",h);/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u=[["circle",{cx:"12",cy:"12",r:"4",key:"4exip2"}],["path",{d:"M12 2v2",key:"tus03m"}],["path",{d:"M12 20v2",key:"1lh1kg"}],["path",{d:"m4.93 4.93 1.41 1.41",key:"149t6j"}],["path",{d:"m17.66 17.66 1.41 1.41",key:"ptbguv"}],["path",{d:"M2 12h2",key:"1t8f8n"}],["path",{d:"M20 12h2",key:"1q8mjw"}],["path",{d:"m6.34 17.66-1.41 1.41",key:"1m8zz5"}],["path",{d:"m19.07 4.93-1.41 1.41",key:"1shlcs"}]],g=o("Sun",u);function p(){const[c,a]=n.useState("system");n.useEffect(()=>{const e=localStorage.getItem("theme");e&&a(e)},[]);function s(e){if(a(e),e==="system"){localStorage.removeItem("theme");const r=matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",r)}else localStorage.setItem("theme",e),document.documentElement.classList.toggle("dark",e==="dark")}const i=[{value:"light",icon:g},{value:"dark",icon:k},{value:"system",icon:l}];return t.jsx("div",{className:"flex items-center gap-0.5 rounded-full bg-white/60 p-1 ring-1 ring-zinc-900/5 backdrop-blur-sm dark:bg-white/5 dark:ring-white/10",children:i.map(e=>t.jsx("button",{onClick:()=>s(e.value),className:d("relative cursor-pointer rounded-full p-1.5 transition-all duration-200",c===e.value?"bg-white text-indigo-600 shadow-sm dark:bg-white/10 dark:text-indigo-400":"text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"),children:t.jsx(e.icon,{className:"relative z-10 h-3.5 w-3.5"})},e.value))})}export{p as ThemeToggle};
