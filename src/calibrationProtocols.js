/** Default Pioreactor calibration protocols per device. */
export const DEVICE_PROTOCOLS = {
  media_pump: {
    protocol_name: "duration_based",
    target_device: "media_pump",
    title: "Media pump calibration",
  },
  waste_pump: {
    protocol_name: "duration_based",
    target_device: "waste_pump",
    title: "Waste pump calibration",
  },
  alt_media_pump: {
    protocol_name: "duration_based",
    target_device: "alt_media_pump",
    title: "Alt-media pump calibration",
  },
  stirring: {
    protocol_name: "dc_based",
    target_device: "stirring",
    title: "Stirring calibration",
  },
  od: {
    protocol_name: "standards",
    target_device: "od",
    title: "OD calibration",
  },
  od90: {
    protocol_name: "standards",
    target_device: "od90",
    title: "OD90 calibration",
  },
};

export const protocolForDevice = (deviceId) => DEVICE_PROTOCOLS[deviceId] || null;
