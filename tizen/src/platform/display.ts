/**
 * Samsung TV Display & Product Information
 */

export interface TvProductInfo {
  model: string;
  firmware: string;
  duid: string;
  isUhd: boolean;
  is8k: boolean;
  resolution: string;
}

export function getTvProductInfo(): TvProductInfo {
  const pinfo = typeof window !== 'undefined' ? window.webapis?.productinfo : undefined;

  let model = 'Samsung Smart TV (Browser / Sim)';
  let firmware = 'Tizen Unknown';
  let duid = 'SIMULATED-DUID';
  let isUhd = false;
  let is8k = false;

  if (pinfo) {
    try {
      model = pinfo.getModel() || model;
      firmware = pinfo.getFirmware() || firmware;
      duid = pinfo.getDuid() || duid;
      isUhd = pinfo.isUdPanelSupported?.() ?? false;
      is8k = pinfo.is8KPanelSupported?.() ?? false;
    } catch (e) {
      console.warn('[display] Failed to read product info', e);
    }
  }

  const resolution = typeof window !== 'undefined'
    ? `${window.screen.width}x${window.screen.height}`
    : '1920x1080';

  return {
    model,
    firmware,
    duid,
    isUhd,
    is8k,
    resolution,
  };
}

