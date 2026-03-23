if (cmd === "sleep") {
  const state = loadState();
  state.manualSleep = true;
  state.manualWake = false;
  saveState(state);
  console.log("💤 Alma is now sleeping. She will be grumpy if disturbed.");
  return;
}
