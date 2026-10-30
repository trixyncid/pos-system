from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class AuthRateThrottle(AnonRateThrottle):
    """Email and password sign-in."""

    scope = "auth"


class PinRateThrottle(UserRateThrottle):
    """PIN unlock, per signed-in tablet session, on top of the per-user lock in User.check_pin."""

    scope = "pin"
