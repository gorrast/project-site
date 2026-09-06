import math

# Upper bound on plausible total-match-goals lambda; a Poisson(15) match is
# absurd, so this is a safe bracket for the bisection search below.
_MAX_LAMBDA = 15.0
_BISECTION_ITERATIONS = 60


def decimal_odds_to_prob(price: float) -> float:
    return 1.0 / price


def normalize_probs(raw_probs: list[float]) -> list[float]:
    """Strips the bookmaker's overround by scaling raw 1/odds probabilities to sum to 1."""
    total = sum(raw_probs)
    return [p / total for p in raw_probs]


def _poisson_cdf(k: int, lam: float) -> float:
    term = math.exp(-lam)
    cumulative = term
    for i in range(1, k + 1):
        term *= lam / i
        cumulative += term
    return cumulative


def poisson_implied_total_goals(p_over_line: float, line: float) -> float:
    """Inverts P(Poisson(lambda) > line) = p_over_line for lambda via bisection.

    There's no closed form for this, and the CDF is monotonic in lambda, so
    bisection over a generous bracket is simpler than pulling in scipy for one
    root-find.
    """
    k = math.floor(line)

    def p_over(lam: float) -> float:
        return 1.0 - _poisson_cdf(k, lam)

    lo, hi = 0.0, _MAX_LAMBDA
    for _ in range(_BISECTION_ITERATIONS):
        mid = (lo + hi) / 2
        if p_over(mid) < p_over_line:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2
