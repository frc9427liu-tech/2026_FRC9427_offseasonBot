// Match events -> venue reactions. The match engine (and the robot sim bridge later) only call `emit`;
// the crowd, scoreboard and lights subscribe here, so new reactions never touch the game logic.
const handlers = new Map();

export const events = {
  on(name, fn) {
    if (!handlers.has(name)) handlers.set(name, []);
    handlers.get(name).push(fn);
  },
  emit(name, data = {}) {
    for (const fn of handlers.get(name) || []) fn(data);
  },
};

// Event names:
//   matchStart            {}
//   score                 { side: 'blue'|'red', points }   a fuel goes in / tower climb
//   phaseChange           { phase: 'AUTO'|'TELEOP'|'ENDGAME' }
//   countdown             { seconds }                      fired at 10, 5 ..
//   matchEnd              { winner: 'blue'|'red'|'tie' }
export function wireCrowd(crowd) {
  const other = (s) => (s === 'blue' ? 'red' : 'blue');
  events.on('matchStart', () => crowd.react('both', 'cheer', 3));
  events.on('score', ({ side, points = 1 }) => crowd.react(side, points >= 5 ? 'cheer' : 'clap', points >= 5 ? 4 : 2));
  events.on('phaseChange', ({ phase }) => { if (phase === 'ENDGAME') crowd.react('both', 'clap', 6); });
  events.on('countdown', ({ seconds }) => { if (seconds <= 10) crowd.react('both', 'clap', 3); });
  events.on('matchEnd', ({ winner }) => {
    if (winner === 'tie') crowd.react('both', 'clap', 6);
    else {
      crowd.react(winner, 'cheer', 10);
      crowd.react(other(winner), 'clap', 4); // polite applause from the losing side
    }
  });
}
