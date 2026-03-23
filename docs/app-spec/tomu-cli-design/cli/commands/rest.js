if (cmd === "rest") {
  const state = loadState();
  state.fatigue = 0;
  state.messageCount = 0;
  state.lastRestTime = Date.now();
  state.manualSleep = false;
  state.manualWake = false;
  saveState(state);
  console.log("✨ Alma is fully rested!");
  return;
}
