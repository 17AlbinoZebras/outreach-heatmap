// src/types/leaflet-coloricon.d.ts
import "leaflet";
declare module "leaflet" {
  class ColorIcon extends Icon {
    constructor(options?: any);
  }
}

declare module "*/L.colorIcon.js" {
  // empty — side-effect only
}