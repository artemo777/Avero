export const TITLE_CATALOG = Object.freeze([
  Object.freeze({ id: "lobby_menace", name: "Lobby Menace", description: "Played 25 game rounds.", unlock: { stat: "gamesPlayed", target: 25 } }),
  Object.freeze({ id: "certified_clutch", name: "Certified Clutch", description: "Won 10 free game rounds.", unlock: { stat: "gameWins", target: 10 } }),
  Object.freeze({ id: "coin_goblin", name: "Coin Goblin", description: "Earned 5,000 virtual coins over time.", unlock: { stat: "lifetimeEarned", target: 5000 } }),
  Object.freeze({ id: "shift_gremlin", name: "Shift Gremlin", description: "Worked 10 shifts.", unlock: { stat: "workShifts", target: 10 } }),
  Object.freeze({ id: "bin_diver_deluxe", name: "Bin Diver Deluxe", description: "Completed 10 scavenging runs.", unlock: { stat: "scavenges", target: 10 } }),
  Object.freeze({ id: "shelf_lord", name: "Shelf Lord", description: "Completed all three collection sets.", unlock: { stat: "completedSets", target: 3 } }),
  Object.freeze({ id: "main_character", name: "Main Character", description: "A little dramatic. A lot iconic.", price: 2500 }),
  Object.freeze({ id: "professional_yapper", name: "Professional Yapper", description: "Has something to say. Always.", price: 1800 }),
  Object.freeze({ id: "low_battery_legend", name: "Low Battery Legend", description: "Running on 2% and pure confidence.", price: 1200 }),
  Object.freeze({ id: "button_masher", name: "Professional Button Masher", description: "The button was asking for it.", price: 2200 })
]);

export function getEligibleMilestoneTitles(stats, completedSets) {
  return TITLE_CATALOG.filter((title) => title.unlock && (
    title.unlock.stat === "completedSets"
      ? completedSets >= title.unlock.target
      : (stats[title.unlock.stat] ?? 0) >= title.unlock.target
  ));
}
