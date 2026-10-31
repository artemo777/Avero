const TIERS = Object.freeze([
  Object.freeze({ name: "Rookie", minWins: 0, nextWins: 5 }),
  Object.freeze({ name: "Contender", minWins: 5, nextWins: 15 }),
  Object.freeze({ name: "Specialist", minWins: 15, nextWins: 30 }),
  Object.freeze({ name: "Champion", minWins: 30, nextWins: null })
]);

const GAMES = Object.freeze([
  Object.freeze({ id: "guess", name: "Guess", winsKey: "guessWins" }),
  Object.freeze({ id: "rps", name: "Duel Deck", winsKey: "rpsWins" }),
  Object.freeze({ id: "coinflip", name: "Coinflip", winsKey: "coinflipWins" }),
  Object.freeze({ id: "vault", name: "The Vault", winsKey: "vaultWins" })
]);

export function getArcadeMastery(stats = {}) {
  return GAMES.map((game) => {
    const wins = Math.max(0, Number.isSafeInteger(stats[game.winsKey]) ? stats[game.winsKey] : 0);
    const tier = [...TIERS].reverse().find((candidate) => wins >= candidate.minWins);
    const nextTier = TIERS.find((candidate) => candidate.minWins > tier.minWins);
    return {
      ...game,
      wins,
      tier: tier.name,
      nextTier: nextTier?.name ?? null,
      progress: nextTier
        ? { current: wins - tier.minWins, required: nextTier.minWins - tier.minWins }
        : null
    };
  });
}
