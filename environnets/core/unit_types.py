"""Unit type catalog.

Defines every kind of hardware unit the canvas can draw:
reactors, pumps, sensors. Each entry has display metadata,
canvas dimensions, and a config schema for its detail panel.
"""

# Category > type_id > definition

REACTOR_TYPES = {
    "pio_20ml": {
        "label": "Pioreactor 20ml",
        "description": "Pioreactor with 20ml glass vial, standard heterogeneity setup.",
        "width": 140,
        "height": 170,
        "config_fields": ["hostname"],
    },
    "pio_40ml": {
        "label": "Pioreactor 40ml",
        "description": "Pioreactor with 40ml vial for larger cultures.",
        "width": 150,
        "height": 180,
        "config_fields": ["hostname"],
    },
    "stirred_tank": {
        "label": "Stirred tank",
        "description": "Larger scale stirred tank bioreactor.",
        "width": 160,
        "height": 200,
        "config_fields": ["hostname", "volume_ml"],
    },
    "microfluidic": {
        "label": "Microfluidic chamber",
        "description": "For biofilm and single cell work.",
        "width": 170,
        "height": 120,
        "config_fields": ["chamber_id"],
    },
    "custom_vessel": {
        "label": "Custom vessel",
        "description": "Generic container, user-defined.",
        "width": 140,
        "height": 160,
        "config_fields": ["label"],
    },
}

PUMP_TYPES = {
    "peristaltic": {
        "label": "Peristaltic pump",
        "description": "Rotor and roller squeeze tubing. Default Pioreactor pump.",
        "width": 120,
        "height": 110,
        "config_fields": ["pwm_channel", "direction", "calibration_ml_per_s"],
        "api_job": {"in": "add_media", "out": "remove_waste"},
    },
    "dual_syringe": {
        "label": "Dual syringe pump",
        "description": "Two syringes, one pushes while other pulls. Handles both directions.",
        "width": 150,
        "height": 100,
        "config_fields": ["gpio_step", "gpio_dir", "syringe_volume_ml"],
        "api_job": None,  # custom firmware
    },
    "single_syringe": {
        "label": "Single syringe pump",
        "description": "One syringe plunger. Precise for small volumes.",
        "width": 130,
        "height": 90,
        "config_fields": ["gpio_step", "gpio_dir", "syringe_volume_ml"],
        "api_job": None,
    },
    "diaphragm": {
        "label": "Diaphragm pump",
        "description": "Pulsing dome chamber. Good for air or thick liquids.",
        "width": 120,
        "height": 100,
        "config_fields": ["pwm_channel", "pulse_hz"],
        "api_job": None,
    },
    "custom_pump": {
        "label": "Custom pump",
        "description": "Generic pump block, user-defined control.",
        "width": 110,
        "height": 90,
        "config_fields": ["gpio_pin", "label"],
        "api_job": None,
    },
}

SENSOR_TYPES = {
    "od": {
        "label": "OD sensor",
        "description": "Optical density. Built into the Pioreactor.",
        "width": 90,
        "height": 100,
        "config_fields": ["channel"],
    },
    "temperature": {
        "label": "Temperature probe",
        "description": "Measures culture temperature.",
        "width": 90,
        "height": 100,
        "config_fields": ["channel"],
    },
    "ph": {
        "label": "pH probe",
        "description": "Measures culture pH.",
        "width": 90,
        "height": 110,
        "config_fields": ["i2c_address"],
    },
    "co2": {
        "label": "CO2 sensor",
        "description": "Dissolved CO2 in headspace.",
        "width": 100,
        "height": 100,
        "config_fields": ["i2c_address"],
    },
    "spectrometer": {
        "label": "Spectrometer",
        "description": "Color and absorbance across wavelengths.",
        "width": 120,
        "height": 100,
        "config_fields": ["usb_port"],
    },
    "dissolved_o2": {
        "label": "Dissolved O2",
        "description": "Dissolved oxygen in culture.",
        "width": 90,
        "height": 110,
        "config_fields": ["i2c_address"],
    },
    "custom_sensor": {
        "label": "Custom sensor",
        "description": "Generic analog sensor input.",
        "width": 90,
        "height": 90,
        "config_fields": ["adc_channel", "label"],
    },
}

CATEGORY_MAP = {
    "reactor": REACTOR_TYPES,
    "pump": PUMP_TYPES,
    "sensor": SENSOR_TYPES,
}


def get_type(category: str, type_id: str) -> dict:
    """Look up a unit type definition by category and id."""
    return CATEGORY_MAP.get(category, {}).get(type_id, {})


def list_types(category: str) -> list:
    """Return all types in a category as (id, definition) tuples."""
    return list(CATEGORY_MAP.get(category, {}).items())


def default_dims(category: str, type_id: str) -> tuple[int, int]:
    t = get_type(category, type_id)
    return (t.get("width", 120), t.get("height", 100))
