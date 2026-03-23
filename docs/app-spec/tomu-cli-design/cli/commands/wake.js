if (cmd === "wake") {
  const state = loadState();
  state.manualSleep = false;
  state.manualWake = true;
  state.fatigue = Math.max(0, state.fatigue - 30);
  state.lastRestTime = Date.now();
  saveState(state);
  console.log("☀️ Alma is awake now!");
  return;
}
