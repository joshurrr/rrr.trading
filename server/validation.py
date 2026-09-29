"""Shared server-side validation. Never trust configuration supplied by a browser."""
import math

CHOICES = {
    'scope': ['Global', 'North America', 'Europe', 'Asia Pacific', 'United States', 'Australia', 'United Kingdom', 'China', 'Japan'],
    'assets': ['Multi-asset', 'Equities', 'Crypto', 'FX', 'Commodities'],
    'timeframe': ['Swing · days to weeks', 'Intraday', 'Position · weeks to months'],
    'tolerance': ['Conservative', 'Balanced', 'Higher risk'],
}


def validate_config(config):
    def weights(value, length):
        return isinstance(value, list) and len(value) == length and all(type(n) is int and 0 <= n <= 100 for n in value)

    if not isinstance(config, dict) or set(config) != {'weights', 'subweights', 'profile'}:
        return False
    if not weights(config['weights'], 6) or not any(config['weights']):
        return False
    sub = config['subweights']
    if not isinstance(sub, list) or len(sub) != 6:
        return False
    if not all(weights(w, 3) and (not config['weights'][i] or any(w)) for i, w in enumerate(sub)):
        return False
    profile = config['profile']
    if not isinstance(profile, dict) or set(profile) != set(CHOICES) | {'riskLimit'}:
        return False
    if not all(profile[k] in values for k, values in CHOICES.items()):
        return False
    risk = profile['riskLimit']
    return type(risk) in (int, float) and math.isfinite(risk) and 0.1 <= risk <= 5
