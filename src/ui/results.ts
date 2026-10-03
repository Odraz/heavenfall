/** The Results screen (§3): Victory or Defeat, run time and kills per player. */

export interface ResultsData {
  result: 'victory' | 'defeat';
  timeMs: number;
  /** Players still connected at the end. */
  kills: Array<{ name: string; kills: number }>;
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Builds the Results screen; `onBack` runs when `Back to title` is pressed. */
export function showResults(data: ResultsData, onBack: () => void): HTMLElement {
  const screen = document.createElement('div');
  screen.className = 'screen results';
  const h1 = document.createElement('h1');
  h1.textContent = data.result === 'victory' ? 'Victory' : 'Defeat';
  const time = document.createElement('div');
  time.className = 'run-time';
  time.textContent = `Run time ${formatTime(data.timeMs)}`;
  const table = document.createElement('table');
  for (const k of data.kills) {
    const tr = table.insertRow();
    tr.insertCell().textContent = k.name;
    tr.insertCell().textContent = `${k.kills} kills`;
  }
  const back = document.createElement('button');
  back.className = 'button';
  back.textContent = 'Back to title';
  back.addEventListener('click', onBack);
  screen.append(h1, time, table, back);
  return screen;
}
